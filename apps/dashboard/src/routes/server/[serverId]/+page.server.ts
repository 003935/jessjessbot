import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { getDiscordAcc, throwIfNotLoggedIn } from '$lib/server/permission.utils';
import { discordApi } from '$lib/server/discord';
import { ChannelType } from 'discord-api-types/v10';

export const load: PageServerLoad = async ({ params, locals }) => {
	const user = throwIfNotLoggedIn(locals);

	const { isAdmin, guild } = await getDiscordAcc(user, params.serverId);

	const eventGames = await db.games.getAll();
	const upcomingCustoms = await Promise.all(
		(await db.events.getEventsByGuildIds([guild.id]))
			.filter((event) => event.scheduledTime.getTime() > Date.now())
			.sort((a, b) => a.scheduledTime.getTime() - b.scheduledTime.getTime())
			.slice(0, 10)
			.map(async (event) => {
				const signups = await db.events.getSignups(event.id);
				const overrides = new Map(signups.map((signup) => [signup.userId, signup.status]));
				const teamEmoji = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'].slice(0, event.teamCount || 0);
				const reactionUsers = await Promise.all(
					(event.teamCount ? teamEmoji : ['✅']).map((emoji) =>
						discordApi.getReactionUsers(event.channelId, event.messageId, emoji).catch(() => [])
					)
				);
				const legacyIds = new Set(
					reactionUsers
						.flat()
						.filter((member) => !overrides.has(member.id))
						.map((member) => member.id)
				);
				const storedJoinedIds = new Set(
					signups.filter((signup) => signup.status === 'JOINED').map((signup) => signup.userId)
				);
				return {
					id: event.id,
					gameName: event.gameName,
					name: event.name,
					channelId: event.channelId,
					messageId: event.messageId,
					scheduledTime: event.scheduledTime.toISOString(),
					joinedCount: new Set([...legacyIds, ...storedJoinedIds]).size,
					maybeCount: signups.filter((signup) => signup.status === 'MAYBE').length,
				};
			})
	);
	const emojis = await discordApi.getEmojis();

	let channels: null | Awaited<ReturnType<typeof discordApi.getGuildChannels>> = null;
	let wordleImport: null | Awaited<ReturnType<typeof db.wordleImport.getGuildImport>> = null;
	let config: null | Awaited<ReturnType<typeof db.config.getConfig>> = null;
	let hallChannels: Awaited<ReturnType<typeof db.hall.getChannels>> = [];
	let hallImport: Awaited<ReturnType<typeof db.hall.getImport>> = null;
	let savedUsers: Array<{
		id: string;
		name: string;
		avatar: string | null;
		loot: Array<{ itemName: string; quantity: number }>;
		nickname: string | null;
		likes: string[];
		dislikes: string[];
		relationship: { score: number; interactionCount: number; updatedAt: Date } | null;
		pets: string[];
		leagueAccounts: Array<{ gameName: string | null; tagline: string | null; region: string }>;
		wordleGames: number;
		customSignups: number;
	}> = [];
	if (isAdmin) {
		channels = await discordApi.getGuildChannels(guild.id);
		wordleImport = await db.wordleImport.getGuildImport(params.serverId);
		config = await db.config.getConfig(guild.id);
		hallChannels = await db.hall.getChannels(guild.id, true);
		hallImport = await db.hall.getImport(guild.id);
		const [relationships, preferences, lootRows, pets, leagueAccounts, wordleRows, signupRows] =
			await Promise.all([
				db._db.botRelationship.findMany({ where: { guildId: guild.id } }),
				db._db.botMemberPreference.findMany({ where: { guildId: guild.id } }),
				db._db.lootInventory.findMany({
					where: { quantity: { gt: 0 } },
					orderBy: { itemName: 'asc' },
				}),
				db._db.pet.findMany({
					where: { guildId: guild.id },
					select: { ownerId: true, name: true },
				}),
				db._db.leagueAccount.findMany({
					select: { discordId: true, riotGamename: true, riotTagline: true, region: true },
				}),
				db._db.wordleResult.findMany({
					where: { message: { guildId: guild.id } },
					select: { discordId: true },
				}),
				db._db.customSignup.findMany({
					where: { event: { guildId: guild.id } },
					select: { userId: true },
				}),
			]);
		const ids = new Set<string>([
			...relationships.map((row) => row.userId),
			...preferences
				.filter((row) => ['like', 'dislike', 'nickname'].includes(row.kind))
				.map((row) => row.userId),
			...pets.map((row) => row.ownerId),
			...wordleRows.map((row) => row.discordId),
			...signupRows.map((row) => row.userId),
		]);
		const preferenceByUser = new Map<string, typeof preferences>();
		for (const row of preferences) {
			if (!['like', 'dislike', 'nickname'].includes(row.kind)) continue;
			preferenceByUser.set(row.userId, [...(preferenceByUser.get(row.userId) ?? []), row]);
		}
		const relationshipByUser = new Map(relationships.map((row) => [row.userId, row]));
		const groupByUser = <T>(rows: T[], key: (row: T) => string) => {
			const map = new Map<string, T[]>();
			for (const row of rows) map.set(key(row), [...(map.get(key(row)) ?? []), row]);
			return map;
		};
		const lootByUser = groupByUser(lootRows, (row) => row.discordId);
		const petsByUser = groupByUser(pets, (row) => row.ownerId);
		const leagueByUser = groupByUser(leagueAccounts, (row) => row.discordId);
		const wordleCountByUser = new Map<string, number>();
		for (const row of wordleRows)
			wordleCountByUser.set(row.discordId, (wordleCountByUser.get(row.discordId) ?? 0) + 1);
		const signupCountByUser = new Map<string, number>();
		for (const row of signupRows)
			signupCountByUser.set(row.userId, (signupCountByUser.get(row.userId) ?? 0) + 1);
		savedUsers = await Promise.all(
			[...ids].map(async (id) => {
				let name = id;
				let avatar: string | null = null;
				try {
					const discordUser = await discordApi.getUser(id);
					name = discordUser.global_name || discordUser.username;
					avatar = discordUser.avatar
						? `https://cdn.discordapp.com/avatars/${id}/${discordUser.avatar}.webp?size=96&quality=lossless`
						: null;
				} catch {
					/* Keep the ID visible when Discord cannot resolve this account. */
				}
				const userPreferences = preferenceByUser.get(id) ?? [];
				const relationship = relationshipByUser.get(id);
				return {
					id,
					name,
					avatar,
					loot: (lootByUser.get(id) ?? []).map(({ itemName, quantity }) => ({
						itemName,
						quantity,
					})),
					nickname: userPreferences.find((row) => row.kind === 'nickname')?.value ?? null,
					likes: userPreferences.filter((row) => row.kind === 'like').map((row) => row.value),
					dislikes: userPreferences.filter((row) => row.kind === 'dislike').map((row) => row.value),
					relationship: relationship
						? {
								score: relationship.score / 10,
								interactionCount: relationship.interactionCount,
								updatedAt: relationship.updatedAt,
							}
						: null,
					pets: (petsByUser.get(id) ?? []).map((row) => row.name),
					leagueAccounts: (leagueByUser.get(id) ?? []).map((row) => ({
						gameName: row.riotGamename,
						tagline: row.riotTagline,
						region: row.region,
					})),
					wordleGames: wordleCountByUser.get(id) ?? 0,
					customSignups: signupCountByUser.get(id) ?? 0,
				};
			})
		);
		savedUsers.sort((a, b) => a.name.localeCompare(b.name));
	}

	return {
		guild: {
			...guild,
			icon: guild.icon
				? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.webp?size=128&quality=lossless`
				: null,
		},
		games: eventGames,
		upcomingCustoms,
		emojis: await emojis,
		isAdmin,
		channels: channels
			?.filter((c) => c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement)
			.map((c) => ({ id: c.id, name: c.name })),
		config,
		wordleImport: wordleImport
			? {
					lastImport: wordleImport.lastImport,
					importedBy: wordleImport.importedBy,
					messagesImported: wordleImport.messagesImported,
				}
			: null,
		hallChannelIds: hallChannels.map((channel) => channel.channelId),
		hallImport: hallImport
			? {
					lastImport: hallImport.lastImport,
					messagesScanned: hallImport.messagesScanned,
					messagesImported: hallImport.messagesImported,
				}
			: null,
		savedUsers,
	};
};
