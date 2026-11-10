import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { discordApi } from '$lib/server/discord';
import { getDiscordAcc, throwIfNotLoggedIn } from '$lib/server/permission.utils';
import { factLabel } from '$lib/memory-label';
import { isCurrent } from '@repo/database';

export const load: PageServerLoad = async ({ params, url, locals }) => {
	const user = throwIfNotLoggedIn(locals);

	const { discordId } = params;

	const serverId = url.searchParams.get('serverId');

	// Only the member themselves or a server admin may see what jjb remembers about them.
	let memory: {
		facts: Array<{ id: string; text: string; label: string }>;
		past: Array<{ id: string; text: string; label: string }>;
		likes: string[];
		dislikes: string[];
		pets: string[];
		favourites: string[];
		birthday: string | null;
		autoMemory: boolean;
	} | null = null;
	if (serverId) {
		const { isAdmin, discordID } = await getDiscordAcc(user, serverId).catch(() => ({
			isAdmin: false,
			discordID: '',
		}));
		if (isAdmin || discordID === discordId) {
			const [all, prefs, autoMemory] = await Promise.all([
				db.botMemory.listFor(serverId, discordId),
				db.botMemberPreference.list(serverId, discordId),
				db.botMemberPreference.autoMemoryEnabled(serverId, discordId),
			]);
			const view = (fact: (typeof all)[number]) => ({
				id: fact.id,
				text: fact.text,
				label: factLabel(fact),
			});
			memory = {
				facts: all.filter((fact) => isCurrent(fact)).map(view),
				past: all.filter((fact) => fact.validTo).map(view),
				likes: prefs.likes,
				dislikes: prefs.dislikes,
				pets: prefs.pets,
				favourites: prefs.favourites,
				birthday: prefs.birthday,
				autoMemory,
			};
		}
	}

	// On their own profile without a server picked: which servers she remembers them in.
	let memoryServers: Array<{ id: string; name: string }> = [];
	if (!serverId) {
		const account = await db._db.account.findFirst({
			where: { userId: user.id, providerId: 'discord' },
		});
		if (account?.accountId === discordId)
			memoryServers = await Promise.all(
				(await db.botMemory.guildsFor(discordId)).map(async (id) => ({
					id,
					name: await discordApi
						.getGuild(id)
						.then((guild) => guild.name)
						.catch(() => 'a server'),
				}))
			);
	}

	const userStats = await db.wordle.getUserStats(discordId);

	let discordUser: {
		username: string;
		displayName: string;
		avatar: string | null;
	} | null = null;

	try {
		const user = await discordApi.getUser(discordId);
		if (user) {
			discordUser = {
				username: user.username,
				displayName: user.global_name || user.username,
				avatar: user.avatar,
			};
		}
	} catch {
		discordUser = null;
	}

	const avatarUrl = discordUser?.avatar
		? `https://cdn.discordapp.com/avatars/${discordId}/${discordUser.avatar}.webp?size=128&quality=lossless`
		: null;

	return {
		discordId,
		displayName: discordUser?.displayName || `User ${discordId}`,
		avatarUrl,
		stats: userStats,
		serverId,
		memory,
		memoryServers,
	};
};
