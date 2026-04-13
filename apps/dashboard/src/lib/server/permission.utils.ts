import { error } from '@sveltejs/kit';
import { discordApi } from '$lib/server/discord';
import { _isGuildAdmin } from './discord.utils';
import type { APIGuild } from 'discord-api-types/v10';
import { getRequestEvent } from '$app/server';

export function throwIfNotLoggedIn(locals: App.Locals = getRequestEvent().locals) {
	const user = locals.user;
	if (!user) return error(401, 'Not logged in');
	return user;
}

export async function getDiscordAcc(
	user: NonNullable<App.Locals['user']>,
	guild_resolvable: string | Awaitable<APIGuild>
) {
	let awaitable_guild: Awaitable<APIGuild>;
	if (typeof guild_resolvable === 'string') {
		awaitable_guild = discordApi.getGuild(guild_resolvable);
	} else {
		awaitable_guild = guild_resolvable;
	}
	const { isAdmin, discordAccount, guild } = await _isGuildAdmin(user.id, awaitable_guild);

	return {
		isAdmin,
		guild,
		discordID: discordAccount.accountId,
	};
}

export async function throwIfNotAdmin(
	user: NonNullable<App.Locals['user']>,
	guild_resolvable: string | Awaitable<APIGuild>
) {
	const { isAdmin, discordID, guild } = await getDiscordAcc(user, guild_resolvable);

	if (!isAdmin) error(403, 'Not admin');

	return {
		guild,
		discordID,
	};
}
