import { error } from '@sveltejs/kit';
import { discordApi } from '$lib/server/discord';
import { db } from '$lib/server/db';

const ADMINISTRATOR = 0x8n;
const MANAGE_GUILD = 0x20n;

/** Status code of a Discord REST error (DiscordAPIError), if any. */
function discordErrorStatus(e: unknown): number | undefined {
	if (typeof e === 'object' && e !== null && 'status' in e && typeof e.status === 'number')
		return e.status;
	return undefined;
}

export async function _isGuildAdmin(
	userId: string,
	guild_promise: Awaitable<Awaited<ReturnType<typeof discordApi.getGuild>>>
) {
	const discordAccount = await db._db.account.findFirst({
		where: {
			userId,
			providerId: 'discord',
		},
	});

	if (!discordAccount) error(401, 'No linked Discord account');

	const guild = await Promise.resolve(guild_promise).catch((e: unknown) => {
		const status = discordErrorStatus(e);
		if (status === 403 || status === 404) error(404, 'Server not found');
		throw e;
	});

	if (guild.owner_id === discordAccount.accountId)
		return {
			isAdmin: true,
			discordAccount,
			guild,
		};

	const member = await discordApi
		.getGuildMember(guild.id, discordAccount.accountId)
		.catch((e: unknown) => {
			const status = discordErrorStatus(e);
			if (status === 403 || status === 404) error(403, 'Not a member of this server');
			throw e;
		});

	// @everyone role shares the guild's id and applies to every member
	const memberRoleIds = new Set([guild.id, ...member.roles]);
	const permissions = guild.roles
		.filter((role) => memberRoleIds.has(role.id))
		.reduce((acc, role) => acc | BigInt(role.permissions), 0n);

	const isAdmin =
		(permissions & ADMINISTRATOR) === ADMINISTRATOR ||
		(permissions & MANAGE_GUILD) === MANAGE_GUILD;

	return {
		isAdmin,
		discordAccount,
		guild,
	};
}
