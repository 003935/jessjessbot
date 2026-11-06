import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { throwIfNotLoggedIn } from '$lib/server/permission.utils';

export const load: PageServerLoad = async ({ locals }) => {
	const user = throwIfNotLoggedIn(locals);
	if (user.role !== 'admin') error(403, 'Only the site admin can change jjb’s personality');
	const voice = await db.botVoice.get();
	return {
		voice: {
			personality: voice?.personality ?? '',
			updatedAt: voice?.updatedAt.toISOString() ?? null,
		},
	};
};
