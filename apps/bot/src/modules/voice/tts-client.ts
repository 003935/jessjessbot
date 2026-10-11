const TTS_URL = process.env.OMNIVOICE_URL ?? 'http://omnivoice:8080';
const MAX_TEXT_CHARS = 1900;
const MAX_AUDIO_BYTES = 16 * 1024 * 1024;
const MAX_TRANSCRIBE_BYTES = Math.min(2 * 1024 * 1024, 48_000 * 2 * 15);

export async function synthesizeSpeech(text: string): Promise<Buffer> {
	const normalized = text.trim();
	if (!normalized || normalized.length > MAX_TEXT_CHARS)
		throw new Error('invalid speech text');

	const response = await fetch(`${TTS_URL}/synthesize`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ text: normalized }),
		signal: AbortSignal.timeout(180_000),
	});
	if (!response.ok) throw new Error(`TTS service returned HTTP ${response.status}`);
	if (response.headers.get('content-type')?.split(';', 1)[0]?.trim() !== 'audio/wav')
		throw new Error('TTS service returned an unsupported audio format');
	const contentLength = Number(response.headers.get('content-length'));
	if (Number.isFinite(contentLength) && contentLength > MAX_AUDIO_BYTES)
		throw new Error('TTS audio exceeded the size limit');
	if (!response.body) throw new Error('TTS service returned an empty response');
	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let totalBytes = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			totalBytes += value.byteLength;
			if (totalBytes > MAX_AUDIO_BYTES) {
				await reader.cancel();
				throw new Error('TTS audio exceeded the size limit');
			}
			chunks.push(value);
		}
	} finally {
		reader.releaseLock();
	}
	const audio = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), totalBytes);
	if (
		audio.length < 44 ||
		audio.toString('ascii', 0, 4) !== 'RIFF' ||
		audio.toString('ascii', 8, 12) !== 'WAVE'
	)
		throw new Error('TTS service returned invalid WAV audio');
	return audio;
}

export async function transcribeSpeech(pcm: Buffer): Promise<string> {
	if (!pcm.length || pcm.length > MAX_TRANSCRIBE_BYTES || pcm.length % 2 !== 0)
		throw new Error('invalid transcription audio');

	const response = await fetch(`${TTS_URL}/transcribe`, {
		method: 'POST',
		headers: { 'content-type': 'application/octet-stream' },
		body: new Uint8Array(pcm),
		signal: AbortSignal.timeout(180_000),
	});
	if (!response.ok) throw new Error(`Transcription service returned HTTP ${response.status}`);
	if (response.headers.get('content-type')?.split(';', 1)[0]?.trim() !== 'application/json')
		throw new Error('Transcription service returned an unsupported response format');
	const result: unknown = await response.json();
	if (
		!result ||
		typeof result !== 'object' ||
		!('text' in result) ||
		typeof result.text !== 'string'
	)
		throw new Error('Transcription service returned an invalid response');
	return result.text.trim().slice(0, MAX_TEXT_CHARS);
}
