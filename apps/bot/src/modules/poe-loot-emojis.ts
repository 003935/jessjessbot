import { CLIENT_ID, BOT_TOKEN } from '@/environment';
import { lootImages, LOOT, setLootEmojis, type LootEmoji } from '@/modules/poe-loot';

const API = 'https://discord.com/api/v10';

function emojiName(item: string) {
	return `loot_${item.toLocaleLowerCase().replace(/[^a-z0-9]+/gu, '_').replace(/^_|_$/gu, '')}`.slice(0, 32);
}

export async function uploadPoeLootEmojis(): Promise<void> {
	const headers = { Authorization: `Bot ${BOT_TOKEN}` };
	const list = await fetch(`${API}/applications/${CLIENT_ID}/emojis`, {
		headers, signal: AbortSignal.timeout(15000),
	});
	if (!list.ok) throw new Error(`Could not list application emojis: HTTP ${list.status}`);
	const body = await list.json() as { items?: Array<LootEmoji> };
	const byName = new Map((body.items ?? []).filter(emoji => emoji.name).map(emoji => [emoji.name, emoji]));
	const images = await lootImages();
	const itemEmojis = new Map<string, LootEmoji>();
	let uploaded = 0;
	for (const [item] of LOOT) {
		const name = emojiName(item);
		let emoji = byName.get(name);
		if (!emoji) {
			const imageUrl = images.get(item);
			if (!imageUrl) {
				console.warn(`[PoE loot emojis] No image found for ${item}`);
				continue;
			}
			const response = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) });
			if (!response.ok) {
				console.warn(`[PoE loot emojis] Image fetch failed for ${item}: HTTP ${response.status}`);
				continue;
			}
			const bytes = Buffer.from(await response.arrayBuffer());
			if (bytes.length > 256 * 1024) {
				console.warn(`[PoE loot emojis] Image too large for ${item} (${bytes.length} bytes)`);
				continue;
			}
			const mime = response.headers.get('content-type')?.split(';')[0] || 'image/png';
			const created = await fetch(`${API}/applications/${CLIENT_ID}/emojis`, {
				method: 'POST',
				headers: { ...headers, 'Content-Type': 'application/json' },
				body: JSON.stringify({ name, image: `data:${mime};base64,${bytes.toString('base64')}` }),
				signal: AbortSignal.timeout(20000),
			});
			if (!created.ok) {
				console.error(`[PoE loot emojis] Could not upload ${name}: HTTP ${created.status} ${await created.text()}`);
				continue;
			}
			emoji = await created.json() as LootEmoji;
			byName.set(name, emoji);
			uploaded++;
		}
		itemEmojis.set(item, emoji);
	}
	setLootEmojis(itemEmojis);
	console.info(`[PoE loot emojis] Ready: ${itemEmojis.size}/${LOOT.length} application emojis available; uploaded ${uploaded}`);
}
