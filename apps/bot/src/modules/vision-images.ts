import type { Attachment } from 'discord.js';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_BYTES = 12 * 1024 * 1024;
const MAX_IMAGES = 2;
const SUPPORTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export type VisionImageInput = {
	type: 'image_url';
	image_url: { url: string; detail: 'auto' };
};

function matchesImageType(bytes: Uint8Array, mimeType: string): boolean {
	if (mimeType === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8;
	if (mimeType === 'image/png')
		return bytes.subarray(0, 8).join(',') === '137,80,78,71,13,10,26,10';
	if (mimeType === 'image/gif')
		return Buffer.from(bytes.subarray(0, 6)).toString('ascii').match(/^GIF8[79]a$/u) !== null;
	if (mimeType === 'image/webp')
		return (
			Buffer.from(bytes.subarray(0, 4)).toString('ascii') === 'RIFF' &&
			Buffer.from(bytes.subarray(8, 12)).toString('ascii') === 'WEBP'
		);
	return false;
}

export async function collectVisionImages(attachments: Attachment[]): Promise<{
	images: VisionImageInput[];
	skipped: boolean;
}> {
	const images: VisionImageInput[] = [];
	let totalBytes = 0;
	let skipped = false;

	for (const attachment of attachments) {
		const mimeType = attachment.contentType ?? '';
		if (!SUPPORTED_TYPES.has(mimeType) || attachment.size > MAX_IMAGE_BYTES) {
			skipped = true;
			continue;
		}
		if (images.length >= MAX_IMAGES || totalBytes + attachment.size > MAX_TOTAL_BYTES) {
			skipped = true;
			continue;
		}

		try {
			const response = await fetch(attachment.url, { signal: AbortSignal.timeout(20_000) });
			if (!response.ok) {
				skipped = true;
				continue;
			}
			const bytes = new Uint8Array(await response.arrayBuffer());
			if (
				!bytes.byteLength ||
				bytes.byteLength > MAX_IMAGE_BYTES ||
				totalBytes + bytes.byteLength > MAX_TOTAL_BYTES ||
				!matchesImageType(bytes, mimeType)
			) {
				skipped = true;
				continue;
			}
			totalBytes += bytes.byteLength;
			images.push({
				type: 'image_url',
				image_url: {
					url: `data:${mimeType};base64,${Buffer.from(bytes).toString('base64')}`,
					detail: 'auto',
				},
			});
		} catch {
			skipped = true;
		}
	}

	return { images, skipped };
}
