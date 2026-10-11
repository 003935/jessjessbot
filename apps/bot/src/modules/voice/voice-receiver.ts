import { EndBehaviorType, type VoiceConnection } from '@discordjs/voice';
import { opus } from 'prism-media';
import type { AudioReceiveStream } from '@discordjs/voice';
import type { Transform } from 'node:stream';

const MAX_UTTERANCE_BYTES = 48_000 * 2 * 15;
const MAX_PENDING_UTTERANCES = 5;

type Capture = {
	userId: string;
	packets: AudioReceiveStream;
	decoder: Transform;
	chunks: Buffer[];
	bytes: number;
	failed: boolean;
	ended: boolean;
};

export type VoiceReceiverController = { stop(): void };

export function startVoiceReceiver(
	connection: VoiceConnection,
	canAcceptUser: (userId: string) => boolean,
	onUtterance: (userId: string, pcm: Buffer) => Promise<void>,
	onError: (error: unknown) => void
): VoiceReceiverController {
	const receiver = connection.receiver;
	const captures = new Map<string, Capture>();
	const queue: Array<{ userId: string; pcm: Buffer }> = [];
	let reserved = 0;
	let stopped = false;
	let processing = false;

	const reportError = (error: unknown) => {
		if (!stopped) onError(error);
	};

	const drain = async () => {
		if (processing || stopped) return;
		processing = true;
		try {
			while (!stopped && queue.length) {
				const item = queue.shift();
				if (!item) continue;
				try {
					await onUtterance(item.userId, item.pcm);
				} catch (error) {
					reportError(error);
				} finally {
					reserved = Math.max(0, reserved - 1);
				}
			}
		} finally {
			processing = false;
		}
	};

	const startCapture = (userId: string) => {
		if (stopped || captures.has(userId) || !canAcceptUser(userId)) return;
		if (reserved >= MAX_PENDING_UTTERANCES) return;

		let packets: AudioReceiveStream;
		let decoder: Transform;
		try {
			packets = receiver.subscribe(userId, {
				end: { behavior: EndBehaviorType.AfterSilence, duration: 800 },
			});
			decoder = new opus.Decoder({ rate: 48_000, channels: 1, frameSize: 960 });
		} catch (error) {
			reportError(error);
			return;
		}

		const capture: Capture = {
			userId,
			packets,
			decoder,
			chunks: [],
			bytes: 0,
			failed: false,
			ended: false,
		};
		captures.set(userId, capture);
		reserved++;

		const finish = () => {
			if (capture.ended) return;
			capture.ended = true;
			captures.delete(userId);
			if (stopped) return;
			if (capture.failed || !capture.bytes || capture.bytes % 2) {
				reserved = Math.max(0, reserved - 1);
				return;
			}
			queue.push({ userId, pcm: Buffer.concat(capture.chunks, capture.bytes) });
			capture.chunks = [];
			void drain();
		};
		const fail = (error: unknown) => {
			if (!capture.failed && !stopped) reportError(error);
			capture.failed = true;
			capture.chunks = [];
			capture.bytes = 0;
			packets.destroy();
			decoder.destroy();
			finish();
		};

		decoder.on('data', (chunk: Buffer) => {
			if (capture.failed || stopped) return;
			const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
			if (capture.bytes + buffer.length > MAX_UTTERANCE_BYTES) {
				fail(new Error('voice utterance exceeded the duration limit'));
				return;
			}
			capture.chunks.push(buffer);
			capture.bytes += buffer.length;
		});
		packets.on('error', fail);
		decoder.on('error', fail);
		decoder.on('end', finish);
		packets.pipe(decoder);
	};

	receiver.speaking.on('start', startCapture);
	return {
		stop() {
			if (stopped) return;
			stopped = true;
			receiver.speaking.off('start', startCapture);
			queue.length = 0;
			reserved = 0;
			for (const capture of captures.values()) {
				capture.ended = true;
				capture.chunks = [];
				capture.packets.destroy();
				capture.decoder.destroy();
			}
			captures.clear();
		},
	};
}
