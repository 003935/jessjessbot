import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { throwIfNotLoggedIn } from '$lib/server/permission.utils';

export const load: PageServerLoad = async ({ locals }) => {
	const user = throwIfNotLoggedIn(locals);
	if (user.role !== 'admin') error(403, 'Only the site admin can change jjb’s voice');
	const voice = await db.botVoice.get();
	return {
		voice: {
			identity: voice?.identity ?? '',
			style: voice?.style ?? '',
			rules: voice?.rules ?? '',
			examples: voice?.examples ?? '',
			emoji: voice?.emoji ?? '',
			foodTastes: voice?.food_tastes ?? '',
			likes: voice?.likes ?? [],
			dislikes: voice?.dislikes ?? [],
			updatedAt: voice?.updatedAt.toISOString() ?? null,
		},
	};
};
