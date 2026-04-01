import { error } from '@sveltejs/kit';
import { discordApi } from './discord';
import { _isGuildAdmin } from './discord.utils';
import type { APIGuild } from 'discord-api-types/v10';

export function isLoggedIn(locals: App.Locals) {
	const user = locals.user;
	if (!user) return error(401, 'Not logged in');
	return user;
}

export async function isGuildAdmin(
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
	if (!isAdmin) error(403, 'Not admin');
	return {
		guild,
		isAdmin,
		discordAccount,
	};
}
