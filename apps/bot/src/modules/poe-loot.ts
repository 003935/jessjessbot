// Custom simulator probabilities, in hundredths of a percent (10,000 total).
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, type ButtonInteraction, type Guild } from 'discord.js';
import { db } from '@/db';

export const LOOT = [
	['Exalted Orb',1500], ['Divine Orb',1000], ['Chaos Orb',600],
	['Greater Exalted Orb',500], ['Greater Chaos Orb',300], ['Orb of Annulment',200],
	['Orb of Chance',300], ['Orb of Alchemy',300], ['Regal Orb',300], ['Vaal Orb',300],
	['Orb of Augmentation',200], ['Greater Orb of Augmentation',200], ['Perfect Orb of Augmentation',100],
	['Orb of Transmutation',200], ['Greater Orb of Transmutation',200], ['Perfect Orb of Transmutation',100],
	["Lesser Jeweller's Orb",200], ["Greater Jeweller's Orb",200], ["Perfect Jeweller's Orb",100],
	["Glassblower's Bauble",100], ["Blacksmith's Whetstone",100],
	['Mirror of Kalandra',10], ["Hinekora's Lock",25], ['Temporalis',10], ['Mageblood',50],
	['Headhunter',100], ['Preserved Cranium',100], ['Omen of Light',100], ['Fracturing Orb',100],
	['Waistgate',100], ["Zerphi's Genesis",100], ['Ingenuity',100], ["Cat O' Nine Tails",100],
	['Perfect Exalted Orb',200], ['Perfect Chaos Orb',150], ['Ancient Jawbone',150],
	['Ancient Rib',150], ['Ancient Collarbone',150], ['Tabula Rasa',200],
	["Kalandra's Touch",150], ["Ventor's Gamble",300],
	['Scroll of Wisdom',55], ['Chance Shard',300], ["Artificer's Shard",300],
] as const;

export function isLootRequest(prompt: string): boolean {
	return /\b(?:poe\s*2|path of exile\s*2)\b/i.test(prompt) &&
		/\b(?:loot|drop|roll)\b/i.test(prompt);
}

export function rollLoot(random = Math.random): typeof LOOT[number] {
	const value = random();
	if (!Number.isFinite(value) || value < 0 || value >= 1) throw new Error('Invalid random value');
	let ticket = Math.floor(value * 10000);
	for (const item of LOOT) {
		ticket -= item[1];
		if (ticket < 0) return item;
	}
	throw new Error('Loot weights do not total 10000');
}

export function lootRarityColor(weight: number): number {
	if (weight <= 10) return 0xf1c40f; // jackpot: 0.1% or less
	if (weight <= 100) return 0x9b59b6; // rare: up to 1%
	if (weight <= 300) return 0x3498db; // valuable: up to 3%
	return 0x95a5a6; // ordinary
}

export function lootRarityLabel(weight: number): string {
	if (weight <= 10) return 'Jackpot';
	if (weight <= 100) return 'Rare';
	if (weight <= 300) return 'Valuable';
	return 'Common';
}

type Price = { value: number; unit: string; divineValue?: number; icon?: string; base?: string };
export type LootEmoji = { name: string; id: string; animated: boolean };
let emojiByItem = new Map<string, LootEmoji>();
export function setLootEmojis(emojis: Map<string, LootEmoji>) { emojiByItem = emojis; }
function lootEmojiMarkup(item: string): string {
	const emoji = emojiByItem.get(item);
	return emoji ? `<${emoji.animated ? 'a' : ''}:${emoji.name}:${emoji.id}>` : '';
}
const imageByItem = new Map<string, string>();
const rollLocks = new Map<string, Promise<void>>();
const ROLL_LIMIT = 5;
const ROLL_WINDOW_MS = 30 * 60 * 1000;
const ROLL_COOLDOWN_SCOPE = 'poe-loot-global';
const ROLL_COOLDOWN_KIND = 'roll_window';
export function lootImageUrl(icon: string): string {
	return new URL(icon, 'https://web.poecdn.com').href;
}
type Snapshot = { league: string; at: number; prices: Map<string, Price> };
let snapshot: Snapshot | undefined;
let pending: Promise<Snapshot> | undefined;
let retryAt = 0;
const httpCache = new Map<string, { etag: string | null; body: any }>();

async function getJson(path: string): Promise<any> {
	const cached = httpCache.get(path);
	const response = await fetch(`https://poe.ninja/poe2/api/economy/${path}`, {
		headers: {
			'User-Agent': 'jjb-loot-simulator/1.0 (Discord contact: 718924549692850319)',
			...(cached?.etag ? { 'If-None-Match': cached.etag } : {}),
		},
		signal: AbortSignal.timeout(10000),
	});
	if (response.status === 304 && cached) return cached.body;
	if (!response.ok) {
		const retry = response.headers.get('Retry-After');
		const delay = retry && /^\d+$/.test(retry) ? Number(retry) * 1000 : retry ? Date.parse(retry) - Date.now() : 0;
		retryAt = Date.now() + Math.max(60000, Number.isFinite(delay) ? delay : 0);
		throw new Error(`poe.ninja HTTP ${response.status}`);
	}
	const body = await response.json();
	httpCache.set(path, { etag: response.headers.get('ETag'), body });
	return body;
}

async function refresh(): Promise<Snapshot> {
	const leagues = await getJson('leagues');
	const league = process.env.POE_LOOT_LEAGUE || leagues?.[0]?.id;
	if (!Array.isArray(leagues) || !leagues.some((l: any) => l.id === league)) throw new Error('Unavailable PoE league');
	const prices = new Map<string, Price>();
	for (const category of ['Currency', 'Abyss', 'Ritual', 'UniqueArmours', 'UniqueAccessories']) {
		const unique = category.startsWith('Unique');
		const data = await getJson(`${unique ? 'stash/current/item' : 'exchange/current'}/overview?league=${encodeURIComponent(league)}&type=${category}`);
		const unit = data.core?.items?.find((i: any) => i.id === data.core.primary)?.name;
		if (!unit || !Array.isArray(data.lines)) throw new Error('Unknown poe.ninja schema or price unit');
		for (const line of data.lines) {
			const meta = unique ? line : data.items?.find((i: any) => i.id === line.id);
			if (!meta || !LOOT.some(([name]) => name === meta.name)) continue;
			const icon = meta.icon || meta.image;
			if (icon && !imageByItem.has(meta.name)) imageByItem.set(meta.name, lootImageUrl(icon));
			if (!Number.isFinite(line.primaryValue) || line.primaryValue <= 0) continue;
			if (unique && (line.corrupted || line.variant)) continue;
			const previous = prices.get(meta.name);
			if (previous && (previous.unit !== unit || previous.value <= line.primaryValue)) continue;
			prices.set(meta.name, { value: line.primaryValue, unit,
				divineValue: unit === 'Divine Orb' ? line.primaryValue : undefined,
				base: unique ? line.baseType : undefined,
				icon: icon ? lootImageUrl(icon) : undefined });
		}
	}
	return { league, at: Date.now(), prices };
}

async function ensurePriceSnapshot(): Promise<Snapshot | undefined> {
	if ((!snapshot || Date.now() - snapshot.at >= 3600000) && Date.now() >= retryAt) {
		pending ??= refresh().then(result => snapshot = result).catch(error => {
			retryAt = Math.max(retryAt, Date.now() + 60000);
			throw error;
		}).finally(() => { pending = undefined; });
		await pending;
	}
	return snapshot;
}

export async function lootImages(): Promise<Map<string, string>> {
	await ensurePriceSnapshot();
	return new Map(imageByItem);
}

export function isLootInventoryRequest(prompt: string): boolean {
	return /\b(?:my|check|show|view|what(?:'s| is)? in (?:my|the)?)\b/iu.test(prompt) &&
		/\b(?:inventory|stash|bag|loot|drops?)\b/iu.test(prompt);
}

export function isLootLeaderboardRequest(prompt: string): boolean {
	return /\b(?:poe\s*2?|path of exile\s*2)\b/iu.test(prompt) &&
		/\b(?:loot|drop|inventory|stash)\b/iu.test(prompt) &&
		/\b(?:leaderboard|ranking|rankings|rank|top|value|richest|wealth)\b/iu.test(prompt);
}

export async function lootLeaderboardReply(guild: Guild) {
	const rows = await db._db.lootInventory.findMany({ where: { quantity: { gt: 0 } } });
	if (!rows.length) return 'The PoE 2 loot leaderboard is empty so far. Ask jjb for a loot drop to get started.';
	let prices: Snapshot | undefined;
	try { prices = await ensurePriceSnapshot(); } catch { prices = snapshot; }
	const totals = new Map<string, number>();
	for (const row of rows) {
		const value = prices?.prices.get(row.itemName)?.divineValue;
		if (value !== undefined) totals.set(row.discordId, (totals.get(row.discordId) ?? 0) + value * row.quantity);
	}
	const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
	if (!ranked.length) return 'I can’t build the PoE 2 loot leaderboard because poe.ninja prices are unavailable right now.';
	const divineEmoji = lootEmojiMarkup('Divine Orb') || '💠';
	const lines = await Promise.all(ranked.map(async ([discordId, value], index) => {
		const member = await guild.members.fetch(discordId).catch(() => null);
		const user = member?.user ?? await guild.client.users.fetch(discordId).catch(() => null);
		const name = member?.displayName ?? user?.globalName ?? user?.username ?? 'Unknown player';
		return `${index + 1}. **${name.replace(/([\\`*_{}\[\]()#+.!>|~-])/gu, '\\$1')}** — **${Math.ceil(value).toLocaleString('en-US')}** ${divineEmoji}`;
	}));
	return {
		allowedMentions: { parse: [] as never[] },
		embeds: [new EmbedBuilder()
			.setTitle('🏆 PoE 2 Loot Value Leaderboard')
			.setDescription(lines.join('\n'))],
	};
}

export async function lootInventoryReply(discordId: string, category: 'items' | 'currency' | 'equipment' = 'items') {
	const rows = await db._db.lootInventory.findMany({
		where: { discordId, quantity: { gt: 0 } },
		orderBy: [{ quantity: 'desc' }, { itemName: 'asc' }],
	});
	const equipment = new Set(['Temporalis', 'Tabula Rasa', 'Headhunter', 'Mageblood', "Kalandra's Touch", "Ventor's Gamble", 'Waistgate', "Zerphi's Genesis", 'Ingenuity', "Cat O' Nine Tails"]);
	const categoryFor = (name: string) => equipment.has(name)
		? 'equipment'
		: /\b(?:orb|shard|scroll|bauble|whetstone)\b/iu.test(name) ? 'currency' : 'items';
	const selectedRows = rows.filter((row) => categoryFor(row.itemName) === category);
	let prices: Snapshot | undefined;
	try { prices = await ensurePriceSnapshot(); } catch { prices = snapshot; }
	let totalDivines = 0;
	let missingPrices = false;
	for (const row of rows) {
		const price = prices?.prices.get(row.itemName);
		if (price?.divineValue === undefined) missingPrices = true;
		else totalDivines += price.divineValue * row.quantity;
	}
	const formattedTotal = Math.ceil(totalDivines).toLocaleString('en-US');
	const divineEmoji = lootEmojiMarkup('Divine Orb') || '💠';
	const footer = missingPrices
		? `Known value: ${formattedTotal} ${divineEmoji} • Some prices unavailable`
		: `Full inventory value: ${formattedTotal} ${divineEmoji}`;
	const labels = { items: 'Items', currency: 'Currency', equipment: 'Equipment' } as const;
	const description = selectedRows.length
		? selectedRows.map((row) => `${lootEmojiMarkup(row.itemName)} ${row.itemName} × **${row.quantity}**`).join('\n')
		: rows.length ? `No ${labels[category].toLocaleLowerCase()} in your inventory yet.`
			: 'Your inventory is empty. Ask me for a PoE 2 loot drop to get started.';
	const inventoryDescription = `${description}\n\n**${footer}**`;
	const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
		...(['items', 'currency', 'equipment'] as const).map((tab) =>
			new ButtonBuilder()
				.setCustomId(`poe-inventory:${tab}:${discordId}`)
				.setLabel(tab === 'items' ? 'Item' : labels[tab])
				.setStyle(tab === category ? ButtonStyle.Primary : ButtonStyle.Secondary)
		)
	);
	return {
		allowedMentions: { parse: [] as never[] },
		embeds: [new EmbedBuilder()
			.setTitle(`Your PoE 2 ${labels[category]} Inventory`)
			.setDescription(inventoryDescription)],
		components: [buttons],
	};
}

export async function handleLootInventoryButton(interaction: ButtonInteraction): Promise<boolean> {
	const match = interaction.customId.match(/^poe-inventory:(items|currency|equipment):(\d+)$/u);
	if (!match) return false;
	if (interaction.user.id !== match[2]) {
		await interaction.reply({ content: 'Ask jjb to open your own inventory to use these buttons.', ephemeral: true });
		return true;
	}
	await interaction.deferUpdate();
	await interaction.editReply(await lootInventoryReply(match[2], match[1] as 'items' | 'currency' | 'equipment'));
	return true;
}

async function reserveLootRoll(discordId: string): Promise<number> {
	const previous = rollLocks.get(discordId) ?? Promise.resolve();
	let release!: () => void;
	const turn = new Promise<void>((resolve) => { release = resolve; });
	const tail = previous.then(() => turn);
	rollLocks.set(discordId, tail);
	await previous;
	try {
		const now = Date.now();
		const saved = await db.botMemberPreference.getValue(ROLL_COOLDOWN_SCOPE, discordId, ROLL_COOLDOWN_KIND);
		let timestamps: number[] = [];
		try {
			const parsed: unknown = saved ? JSON.parse(saved) : [];
			if (Array.isArray(parsed)) timestamps = parsed.filter((value): value is number => Number.isFinite(value));
		} catch {
			timestamps = [];
		}
		timestamps = timestamps.filter((timestamp) => timestamp <= now && now - timestamp < ROLL_WINDOW_MS);
		if (timestamps.length >= ROLL_LIMIT) return Math.max(1, timestamps[0]! + ROLL_WINDOW_MS - now);
		timestamps.push(now);
		await db.botMemberPreference.setValue(ROLL_COOLDOWN_SCOPE, discordId, ROLL_COOLDOWN_KIND, JSON.stringify(timestamps));
		return 0;
	} finally {
		release();
		if (rollLocks.get(discordId) === tail) rollLocks.delete(discordId);
	}
}

export async function lootReply(discordId: string) {
	const waitMs = await reserveLootRoll(discordId);
	if (waitMs > 0) {
		const minutes = Math.ceil(waitMs / 60_000);
		return `You’ve used all ${ROLL_LIMIT} loot rolls for now. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`;
	}
	const [name, weight] = rollLoot();
	await db._db.lootInventory.upsert({
		where: { discordId_itemName: { discordId, itemName: name } },
		create: { discordId, itemName: name, quantity: 1 },
		update: { quantity: { increment: 1 } },
	});
	await ensurePriceSnapshot().catch(() => undefined);
	const price = snapshot?.prices.get(name);
	const emoji = emojiByItem.get(name);
	return {
		allowedMentions: { parse: [] as never[] },
		embeds: [{
			title: `${emoji ? `<${emoji.animated ? 'a' : ''}:${emoji.name}:${emoji.id}> ` : ''}${name}`,
			color: lootRarityColor(weight),
			...(price?.icon ? { image: { url: price.icon } } : {}),
		}],
	};
}
