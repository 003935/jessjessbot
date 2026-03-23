import { schema } from '@repo/database';
import { discordApi } from '$lib/server/discord';
import { db } from '$lib/server/db';
import { and, eq } from 'drizzle-orm';
import {
	Routes,
	type RESTGetAPIGuildMemberResult,
	type RESTGetAPIGuildResult,
} from 'discord-api-types/v10';

export async function isGuildAdmin(userId: string, guild: RESTGetAPIGuildResult) {
	const discordAccounts = await db._db
		.select()
		.from(schema.account)
		.where(and(eq(schema.account.userId, userId), eq(schema.account.providerId, 'discord')));

	const discordAccount = discordAccounts[0];

	if (!discordAccount) throw new Error('Couldnt find discord account');

	if (guild.owner_id === discordAccount.accountId) return true;

	const adminRoles = guild.roles.filter((role) => (BigInt(role.permissions) & 0x8n) === 0x8n);

	const member = (await discordApi.get(
		Routes.guildMember(guild.id, discordAccount.accountId)
	)) as RESTGetAPIGuildMemberResult;

	const hasAdminRole = member.roles.some((role) =>
		adminRoles.some((adminRole) => adminRole.id === role)
	);

	return hasAdminRole;
}
