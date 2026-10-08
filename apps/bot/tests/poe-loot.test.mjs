import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LOOT, rollLoot, isLootRequest, lootImageUrl } from '../src/modules/poe-loot.ts';

test('exchange image paths use the PoE CDN and absolute unique icons stay intact', () => {
	assert.equal(lootImageUrl('/gen/image/currency.png'), 'https://web.poecdn.com/gen/image/currency.png');
	assert.equal(lootImageUrl('https://web.poecdn.com/unique.png'), 'https://web.poecdn.com/unique.png');
});

test('all 10,000 tickets give exactly the configured distribution', () => {
	assert.equal(LOOT.reduce((sum, [, weight]) => sum + weight, 0), 10000);
	assert.equal(new Set(LOOT.map(([name]) => name)).size, 40);
	const counts = new Map();
	for (let i = 0; i < 10000; i++) {
		const [name] = rollLoot(() => (i + 0.5) / 10000);
		counts.set(name, (counts.get(name) ?? 0) + 1);
	}
	for (const [name, weight] of LOOT) assert.equal(counts.get(name), weight);
	assert.equal(counts.get('Divine Orb'), 1000);
	assert.equal(counts.get('Exalted Orb'), 1500);
	assert.throws(() => rollLoot(() => 1));
});

test('recognizes PoE 2 loot requests without claiming ordinary chat', () => {
	assert.ok(isLootRequest('give me a poe 2 loot drop'));
	assert.ok(isLootRequest('roll path of exile 2 loot'));
	assert.ok(!isLootRequest('give me a gift'));
	assert.ok(!isLootRequest('poe 1 loot'));
});
