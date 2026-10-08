import { fail, type Actions, type PageServerLoad } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { discordApi } from '$lib/server/discord';

async function getLootPricesInDivines(itemNames: Set<string>): Promise<Map<string, number>> {
	const pricesInDivines = new Map<string, number>();
	if (itemNames.size === 0) return pricesInDivines;

	try {
		const getJson = async (path: string) => {
			const response = await fetch(`https://poe.ninja/poe2/api/economy/${path}`, {
				signal: AbortSignal.timeout(10_000),
				headers: { 'User-Agent': 'JessJessBot-Dashboard/1.0' },
			});
			if (!response.ok) throw new Error(`poe.ninja returned HTTP ${response.status}`);
			return response.json() as Promise<any>;
		};
		const leagues = await getJson('leagues');
		const league = process.env.POE_LOOT_LEAGUE || leagues?.[0]?.id;
		if (!Array.isArray(leagues) || !leagues.some((entry: any) => entry.id === league)) return pricesInDivines;

		const values = new Map<string, { value: number; unit: string }>();
		for (const category of ['Currency', 'Abyss', 'Ritual', 'UniqueArmours', 'UniqueAccessories']) {
			const unique = category.startsWith('Unique');
			const data = await getJson(`${unique ? 'stash/current/item' : 'exchange/current'}/overview?league=${encodeURIComponent(league)}&type=${category}`);
			const unit = data.core?.items?.find((item: any) => item.id === data.core.primary)?.name;
			if (!unit || !Array.isArray(data.lines)) continue;
			for (const line of data.lines) {
				const meta = unique ? line : data.items?.find((item: any) => item.id === line.id);
				if (!meta || !itemNames.has(meta.name) || !Number.isFinite(line.primaryValue) || line.primaryValue <= 0) continue;
				if (unique && (line.corrupted || line.variant)) continue;
				const previous = values.get(meta.name);
				if (previous && (previous.unit !== unit || previous.value >= line.primaryValue)) continue;
				values.set(meta.name, { value: line.primaryValue, unit });
			}
		}

		const divine = values.get('Divine Orb');
		for (const [name, price] of values) {
			if (price.unit === 'Divine Orb') pricesInDivines.set(name, price.value);
			else if (divine && price.unit === divine.unit) pricesInDivines.set(name, price.value / divine.value);
		}
	} catch (error) {
		console.warn('Could not load PoE loot prices for dashboard leaderboard', error);
	}
	return pricesInDivines;
}

export const load: PageServerLoad = async ({ locals }) => {
	const bot_guilds_promise = discordApi.getBotGuilds();

	if (!locals.user)
		return {
			servers: [],
			emojis: [],
			user: null,
			bot_guild_count: (await bot_guilds_promise).length,
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
			bot_guild_count: (await bot_guilds_promise).length,
		};
	}

	const user_guilds_promise = discordApi.getUserGuilds(locals.user.id, discordAccount.accessToken);

	const emojis_promise = discordApi.getEmojis();

	const [user_guilds, bot_guilds] = await Promise.all([user_guilds_promise, bot_guilds_promise]);

	const joined_guilds = user_guilds.filter((guild) =>
		bot_guilds.some((bot_guild) => bot_guild.id === guild.id)
	);

	const customs = await db.events.getEventsByGuildIds(joined_guilds.map((guild) => guild.id));
	const lootInventories = locals.user.role === 'admin'
		? await (async () => {
				const rows = await db._db.lootInventory.findMany({ where: { quantity: { gt: 0 } }, orderBy: [{ discordId: 'asc' }, { itemName: 'asc' }] });
				const prices = await getLootPricesInDivines(new Set(rows.map((row) => row.itemName)));
				const inventories = new Map<string, typeof rows>();
				for (const row of rows) inventories.set(row.discordId, [...(inventories.get(row.discordId) ?? []), row]);
				return Promise.all([...inventories].map(async ([discordId, inventory]) => {
					let name = discordId;
					try {
						const user = await discordApi.getUser(discordId);
						name = user.global_name ?? user.username;
					} catch { /* Keep the Discord ID visible if the account is unavailable. */ }
					const totalDivines = inventory.reduce((total, item) => total + (prices.get(item.itemName) ?? 0) * item.quantity, 0);
					const unpricedItems = inventory.filter((item) => !prices.has(item.itemName)).length;
					return { discordId, name, inventory, totalDivines, unpricedItems };
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
		bot_guild_count: bot_guilds.length,
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
