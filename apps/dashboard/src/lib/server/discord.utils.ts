import { schema } from '@repo/database';
import { discordApi } from '$lib/server/discord';
import { db } from '$lib/server/db';
import { and, eq } from 'drizzle-orm';

export async function _isGuildAdmin(
	userId: string,
	guild_promise: Awaitable<Awaited<ReturnType<typeof discordApi.getGuild>>>
) {
	const discordAccounts = await db._db
		.select()
		.from(schema.account)
		.where(and(eq(schema.account.userId, userId), eq(schema.account.providerId, 'discord')));

	const discordAccount = discordAccounts[0];

	if (!discordAccount) throw new Error('Couldnt find discord account');

	const guild = await guild_promise;

	if (guild.owner_id === discordAccount.accountId)
		return {
			isAdmin: true,
			discordAccount,
			guild,
		};

	const member = discordApi.getGuildMember(guild.id, discordAccount.accountId);

	const adminRoles = guild.roles.filter((role) => (BigInt(role.permissions) & 0x8n) === 0x8n);

	const hasAdminRole = (await member).roles.some((role) =>
		adminRoles.some((adminRole) => adminRole.id === role)
	);

	return {
		isAdmin: hasAdminRole,
		discordAccount,
		guild,
	};
}
