import { createAuthClient } from 'better-auth/svelte';
import { adminClient } from 'better-auth/client/plugins';
import { ac, admin, user } from './auth.permissions';

export const authClient = createAuthClient({
	plugins: [
		adminClient({
			ac,
			roles: {
				admin,
				user,
			},
		}),
	],
});
