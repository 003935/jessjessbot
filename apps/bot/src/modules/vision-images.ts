import sharp from 'sharp';

const MAX_SOURCE_IMAGE_BYTES = 64 * 1024 * 1024;
const MAX_IMAGE_BYTES = 32 * 1024 * 1024;
const MAX_TOTAL_BYTES = 32 * 1024 * 1024;
const MAX_IMAGES = 2;
const MAX_IMAGE_EDGE = 2048;
const TARGET_IMAGE_BYTES = 6 * 1024 * 1024;
const SUPPORTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export type VisionImageSource = { url: string; messageId: string; size?: number };

export type VisionImageInput = {
	type: 'image_url';
	image_url: { url: string; detail: 'auto' };
};

const DISCORD_CDN_HOSTS = new Set(['cdn.discordapp.com', 'media.discordapp.net']);
const MAX_URL_IMAGE_BYTES = 64 * 1024 * 1024;

/** Extract only direct Discord CDN attachment URLs from message text. */
export function extractDiscordImageLinks(content: string): string[] {
	const candidates = content.match(/https:\/\/[^\s<>]+/giu) ?? [];
	const urls = new Set<string>();
	for (const candidate of candidates) {
		const cleaned = candidate
			.replace(/\\([&_])/gu, '$1')
			.replace(/\\_/gu, '_')
			.replace(/&amp;/giu, '&')
			.replace(/[),.!?\]}]+$/u, '');
		try {
			const url = new URL(cleaned);
			if (
				url.protocol === 'https:' &&
				DISCORD_CDN_HOSTS.has(url.hostname.toLowerCase()) &&
				url.pathname.startsWith('/attachments/') &&
				/\.(?:gif|png|jpe?g|webp)$/iu.test(url.pathname)
			)
				urls.add(url.toString());
		} catch {
			// Ignore malformed URLs in user text.
		}
	}
	return [...urls];
}

async function optimizeImage(bytes: Uint8Array, mimeType: string): Promise<{
	bytes: Buffer;
	mimeType: string;
	compressed: boolean;
}> {
	const input = Buffer.from(bytes);
	const metadata = await sharp(input, { animated: mimeType === 'image/gif' }).metadata();
	const largestEdge = Math.max(metadata.width ?? 0, metadata.height ?? 0);
	if (input.byteLength <= TARGET_IMAGE_BYTES && largestEdge <= MAX_IMAGE_EDGE)
		return { bytes: input, mimeType, compressed: false };

	for (const settings of [
		{ edge: MAX_IMAGE_EDGE, quality: 84 },
		{ edge: 1600, quality: 76 },
		{ edge: 1280, quality: 68 },
	]) {
		const output = await sharp(input, { animated: mimeType === 'image/gif' })
			.rotate()
			.resize({ width: settings.edge, height: settings.edge, fit: 'inside', withoutEnlargement: true })
			.webp({ quality: settings.quality, effort: 4 })
			.toBuffer();
		if (output.byteLength <= TARGET_IMAGE_BYTES)
			return { bytes: output, mimeType: 'image/webp', compressed: true };
	}

	if (input.byteLength <= MAX_IMAGE_BYTES)
		return { bytes: input, mimeType, compressed: false };
	throw new Error('Image could not be reduced below the inline limit');
}

function detectImageType(bytes: Uint8Array): string | null {
	if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
	if (bytes.subarray(0, 8).join(',') === '137,80,78,71,13,10,26,10') return 'image/png';
	if (
		Buffer.from(bytes.subarray(0, 6))
			.toString('ascii')
			.match(/^GIF8[79]a$/u)
	)
		return 'image/gif';
	if (
		Buffer.from(bytes.subarray(0, 4)).toString('ascii') === 'RIFF' &&
		Buffer.from(bytes.subarray(8, 12)).toString('ascii') === 'WEBP'
	)
		return 'image/webp';
	return null;
}

export async function collectVisionImages(sources: VisionImageSource[]): Promise<{
	images: VisionImageInput[];
	sourceMessageIds: string[];
	skipped: boolean;
	skippedReasons: string[];
	compressedCount: number;
	sourceBytes: number;
	outputBytes: number;
}> {
	const images: VisionImageInput[] = [];
	const sourceMessageIds: string[] = [];
	const skippedReasons = new Set<string>();
	let compressedCount = 0;
	let totalBytes = 0;
	let sourceBytes = 0;

	for (const { url, size, messageId } of sources) {
		if ((size ?? 0) > MAX_SOURCE_IMAGE_BYTES) {
			skippedReasons.add('source-attachment-over-64-MiB-limit');
			continue;
		}
		if (images.length >= MAX_IMAGES) {
			skippedReasons.add('image-count-or-total-size-limit');
			continue;
		}

		try {
			const parsedUrl = new URL(url);
			if (
				parsedUrl.protocol !== 'https:' ||
				!DISCORD_CDN_HOSTS.has(parsedUrl.hostname.toLowerCase()) ||
				!parsedUrl.pathname.startsWith('/attachments/')
			) {
				skippedReasons.add('url-not-a-discord-cdn-attachment');
				continue;
			}
			const response = await fetch(parsedUrl, {
				signal: AbortSignal.timeout(20_000),
				redirect: 'error',
			});
			if (!response.ok) {
				skippedReasons.add(`attachment-download-http-${response.status}`);
				continue;
			}
			const declaredLength = Number(response.headers.get('content-length'));
			if (Number.isFinite(declaredLength) && declaredLength > MAX_URL_IMAGE_BYTES) {
				skippedReasons.add('downloaded-image-over-64-MiB-limit');
				continue;
			}
			const bytes = new Uint8Array(await response.arrayBuffer());
			if (bytes.byteLength > MAX_URL_IMAGE_BYTES) {
				skippedReasons.add('downloaded-image-over-64-MiB-limit');
				continue;
			}
			const mimeType = detectImageType(bytes);
			if (
				!bytes.byteLength ||
				!mimeType ||
				!SUPPORTED_TYPES.has(mimeType)
			) {
				if (!bytes.byteLength || !mimeType)
					skippedReasons.add('downloaded-content-is-not-a-supported-image');
				continue;
			}
			const optimized = await optimizeImage(bytes, mimeType);
			if (
				optimized.bytes.byteLength > MAX_IMAGE_BYTES ||
				totalBytes + optimized.bytes.byteLength > MAX_TOTAL_BYTES
			) {
				skippedReasons.add('processed-images-over-32-MiB-request-limit');
				continue;
			}
			sourceBytes += bytes.byteLength;
			totalBytes += optimized.bytes.byteLength;
			if (optimized.compressed) compressedCount++;
			images.push({
				type: 'image_url',
				image_url: {
					url: `data:${optimized.mimeType};base64,${optimized.bytes.toString('base64')}`,
					detail: 'auto',
				},
			});
			sourceMessageIds.push(messageId);
		} catch {
			skippedReasons.add('attachment-download-or-image-processing-failed');
		}
	}

	return {
		images,
		sourceMessageIds,
		skipped: skippedReasons.size > 0,
		skippedReasons: [...skippedReasons],
		compressedCount,
		sourceBytes,
		outputBytes: totalBytes,
	};
}
