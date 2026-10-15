import type { PageServerLoad } from './$types';
import { getDiscordAcc, throwIfNotLoggedIn } from '$lib/server/permission.utils';

export const load: PageServerLoad = async ({ params, locals }) => {
	const user = throwIfNotLoggedIn(locals);

	const { isAdmin, guild } = await getDiscordAcc(user, params.serverId);

	return {
		guild: {
			...guild,
			icon: guild.icon
				? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.webp?size=128&quality=lossless`
				: null,
		},
		isAdmin,
	};
};
