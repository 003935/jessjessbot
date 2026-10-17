/// <reference types="bun" />
import { afterEach, expect, test } from 'bun:test';
import { collectVisionImages } from '../src/modules/vision-images';

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

test('stops streaming an image link beyond the 64 MiB limit despite a small advertised length', async () => {
	let pulls = 0;
	let cancelled = false;
	globalThis.fetch = (async () => new Response(new ReadableStream({
		pull(controller) {
			pulls++;
			controller.enqueue(new Uint8Array(1024 * 1024));
		},
		cancel() { cancelled = true; },
	}), { headers: { 'content-length': '1' } })) as unknown as typeof fetch;
	const result = await collectVisionImages([{
		attachment: { url: 'https://example.com/huge.png', size: 1 } as any,
		messageId: 'post',
	}]);
	expect(result.images).toHaveLength(0);
	expect(result.skippedReasons).toContain('source-attachment-over-64-MiB-limit');
	expect(cancelled).toBe(true);
	expect(pulls).toBeLessThan(70);
});
