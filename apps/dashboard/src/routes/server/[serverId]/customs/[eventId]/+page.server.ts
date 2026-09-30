import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { discordApi } from '$lib/server/discord';
import { getDiscordAcc, throwIfNotLoggedIn } from '$lib/server/permission.utils';

const teamEmoji = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];

export const load: PageServerLoad = async ({ params }) => {
	const user = throwIfNotLoggedIn();
	await getDiscordAcc(user, params.serverId);
	const event = await db._db.custom.findFirst({
		where: { id: Number(params.eventId), guildId: params.serverId },
	});
	if (!event || event.scheduledTime.getTime() <= Date.now()) error(404, 'Event not found');
	const emojis = event.teamCount ? teamEmoji.slice(0, event.teamCount) : ['✅'];
	const reactionGroups = await Promise.all(
		emojis.map(async (emoji) => ({
			emoji,
			users: await discordApi.getReactionUsers(event.channelId, event.messageId, emoji),
		}))
	);
	const signups = await db.events.getSignups(event.id);
	const overrides = new Map(signups.map((signup) => [signup.userId, signup.status]));
	const legacyJoined = reactionGroups[0]!.users.filter((user) => !overrides.has(user.id));
	const joinedIds = new Set(legacyJoined.map((user) => user.id));
	const storedUsers = await Promise.all(
		signups
			.filter((signup) => signup.status === 'JOINED' && !joinedIds.has(signup.userId))
			.map((signup) => discordApi.getUser(signup.userId).catch(() => null))
	);
	const joined = [...legacyJoined, ...storedUsers.filter((user) => Boolean(user && !user.bot))];
	const maybe = await Promise.all(
		signups
			.filter((signup) => signup.status === 'MAYBE')
			.map((signup) => discordApi.getUser(signup.userId).catch(() => null))
	);
	const groups = event.teamCount
		? reactionGroups
		: [
				{ emoji: '✅', status: 'JOINED', users: joined },
				{
					emoji: 'Maybe',
					status: 'MAYBE',
					users: maybe.filter((user) => Boolean(user && !user.bot)),
				},
			];
	const seen = new Set<string>();
	return {
		event: {
			id: event.id,
			guildId: event.guildId,
			name: event.name || event.gameName,
			scheduledTime: event.scheduledTime.toISOString(),
			messageUrl: `https://discord.com/channels/${event.guildId}/${event.channelId}/${event.messageId}`,
			teamCount: event.teamCount,
		},
		groups: groups.map((group) => ({
			emoji: group.emoji,
			status: 'status' in group ? group.status : undefined,
			users: group.users
				.filter((member) => {
					if (seen.has(member.id)) return false;
					seen.add(member.id);
					return true;
				})
				.map((member) => ({ id: member.id, name: member.global_name || member.username })),
		})),
	};
};
