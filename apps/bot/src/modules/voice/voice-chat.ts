import { askDeepSeek } from '@/modules/mention';
import { enqueueGuildSpeech } from './voice-manager';
import type { VoiceUtterance } from './voice-manager';

const MAX_HISTORY_TURNS = 16;
type VoiceTurn = { role: 'user' | 'assistant'; content: string };
const histories = new Map<string, VoiceTurn[]>();
const guildEpochs = new Map<string, number>();

function keyFor(utterance: Pick<VoiceUtterance, 'guildId' | 'userId'>): string {
	return `${utterance.guildId}:${utterance.userId}`;
}

export async function handleVoiceUtterance(utterance: VoiceUtterance): Promise<void> {
	const prompt = utterance.text.trim().slice(0, 1_900);
	if (!prompt) return;
	const key = keyFor(utterance);
	const epoch = guildEpochs.get(utterance.guildId) ?? 0;
	const history = histories.get(key) ?? [];
	const result = await askDeepSeek(
		prompt,
		history,
		false,
		null,
		0,
		null,
		false,
		false,
		utterance.displayName,
		null,
		'',
		utterance.displayName
	);
	if (
		(guildEpochs.get(utterance.guildId) ?? 0) !== epoch ||
		!result.reply ||
		result.roleAction ||
		result.customAction ||
		result.customHelp ||
		result.recapHours !== undefined
	)
		return;
	const reply = result.reply.trim().slice(0, 1_900);
	if (!reply || !enqueueGuildSpeech(utterance.guildId, reply)) return;
	const updatedHistory: VoiceTurn[] = [
		...history,
		{ role: 'user', content: prompt },
		{ role: 'assistant', content: reply },
	];
	histories.set(key, updatedHistory.slice(-MAX_HISTORY_TURNS));
}

export function clearVoiceChatGuild(guildId: string): void {
	guildEpochs.set(guildId, (guildEpochs.get(guildId) ?? 0) + 1);
	for (const key of histories.keys()) {
		if (key.startsWith(`${guildId}:`)) histories.delete(key);
	}
}
