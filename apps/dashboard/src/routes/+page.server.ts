import { fail, type Actions, type PageServerLoad } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { discordApi } from '$lib/server/discord';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user)
		return {
			servers: [],
			emojis: [],
			user: null,
		};

	const discordAccount = await db._db.account.findFirst({
		where: {
			userId: locals.user.id,
			providerId: 'discord',
		},
	});

	if (!discordAccount || !discordAccount.accessToken) {
		return {
			servers: [],
			emojis: [],
			user: locals.user,
		};
	}

	const user_guilds_promise = discordApi.getUserGuilds(locals.user.id, discordAccount.accessToken);
	const bot_guilds_promise = discordApi.getBotGuilds();

	const emojis_promise = discordApi.getEmojis();

	const [user_guilds, bot_guilds] = await Promise.all([user_guilds_promise, bot_guilds_promise]);

	const joined_guilds = user_guilds.filter((guild) =>
		bot_guilds.some((bot_guild) => bot_guild.id === guild.id)
	);

	const customs = await db.events.getEventsByGuildIds(joined_guilds.map((guild) => guild.id));
	const lootInventories = locals.user.role === 'admin'
		? await (async () => {
				const rows = await db._db.lootInventory.findMany({ where: { quantity: { gt: 0 } }, orderBy: [{ discordId: 'asc' }, { itemName: 'asc' }] });
				const inventoryByUser = new Map<string, typeof rows>();
				for (const row of rows) inventoryByUser.set(row.discordId, [...(inventoryByUser.get(row.discordId) ?? []), row]);
				return Promise.all([...inventoryByUser].map(async ([discordId, inventory]) => {
					let name = discordId;
					try {
						const discordUser = await discordApi.getUser(discordId);
						name = discordUser.global_name ?? discordUser.username;
					} catch { /* Keep the Discord ID visible if the account is unavailable. */ }
					return { discordId, name, inventory };
				}));
			})()
		: [];

	return {
		servers: joined_guilds.map((guild) => ({
			id: guild.id,
			name: guild.name,
			icon: guild.icon
				? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.webp?size=96&quality=lossless`
				: null,
			owner: guild.owner,
			permissions: guild.permissions,
		})),
		emojis: await emojis_promise,
		user: locals.user,
		customs,
		lootInventories,
	};
};

export const actions: Actions = {
	resetLoot: async ({ locals }) => {
		if (!locals.user) return fail(401, { message: 'Not logged in' });
		if (locals.user.role !== 'admin') return fail(403, { message: 'Not admin' });
		await db._db.lootInventory.updateMany({ data: { quantity: 0 } });
		return { lootReset: true };
	},
};
