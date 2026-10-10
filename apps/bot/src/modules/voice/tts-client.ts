const TTS_URL = process.env.KITTENTTS_URL ?? 'http://kittentts:8080';
const MAX_TEXT_CHARS = 1900;
const MAX_AUDIO_BYTES = 16 * 1024 * 1024;

export async function synthesizeSpeech(text: string): Promise<Buffer> {
	const normalized = text.trim();
	if (!normalized || normalized.length > MAX_TEXT_CHARS)
		throw new Error('invalid speech text');

	const response = await fetch(`${TTS_URL}/synthesize`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ text: normalized }),
		signal: AbortSignal.timeout(120_000),
	});
	if (!response.ok) throw new Error(`TTS service returned HTTP ${response.status}`);
	if (response.headers.get('content-type')?.split(';', 1)[0]?.trim() !== 'audio/wav')
		throw new Error('TTS service returned an unsupported audio format');
	const contentLength = Number(response.headers.get('content-length'));
	if (Number.isFinite(contentLength) && contentLength > MAX_AUDIO_BYTES)
		throw new Error('TTS audio exceeded the size limit');
	const audio = Buffer.from(await response.arrayBuffer());
	if (audio.length < 44 || audio.length > MAX_AUDIO_BYTES || audio.toString('ascii', 0, 4) !== 'RIFF')
		throw new Error('TTS service returned invalid WAV audio');
	return audio;
}
