import type { LayoutServerLoad } from './$types';
import { db } from '$lib/server/db';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user) {
		return {
			user: null,
			discordId: null,
		};
	}

	const discordAccount = await db._db.account.findFirst({
		where: {
			userId: locals.user.id,
			providerId: 'discord',
		},
	});

	return {
		user: locals.user,
		discordId: discordAccount?.accountId || null,
	};
};
