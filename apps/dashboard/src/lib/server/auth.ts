import { betterAuth } from 'better-auth/minimal';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { env } from '$env/dynamic/private';
import { getRequestEvent } from '$app/server';
import { db } from './db';
import { admin as adminPlugin } from 'better-auth/plugins';
import { ac, admin, user } from '../auth.permissions';
import valkey from './valkey';

export const auth = betterAuth({
	baseURL: env.ORIGIN,
	secret: env.BETTER_AUTH_SECRET,
	database: prismaAdapter(db._db, {
		provider: 'postgresql',
	}),
	secondaryStorage: valkey.authModule,
	socialProviders: {
		discord: {
			clientId: env.DISCORD_CLIENT_ID,
			clientSecret: env.DISCORD_CLIENT_SECRET,
			scope: ['identify', 'email', 'guilds'],
		},
	},
	plugins: [
		adminPlugin({
			ac,
			roles: {
				admin,
				user,
			},
		}),
		sveltekitCookies(getRequestEvent),
	],
});
