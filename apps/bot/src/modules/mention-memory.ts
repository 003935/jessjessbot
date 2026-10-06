import { db } from '@/db';

type PreferenceKind = 'like' | 'dislike';

function preferenceRequest(prompt: string): { kind: PreferenceKind; value: string } | null {
	const match = prompt.match(
		/^(?:that\s+)?i\s+(?:(?:really|absolutely)\s+)?(love|like|hate|dislike|can't stand|dont like|don't like|do not like)\s+(.+?)\s*[.!?]*$/iu
	);
	if (!match) return null;
	const kind: PreferenceKind =
		/^(?:hate|dislike|can't stand|dont like|don't like|do not like)$/iu.test(match[1]!)
			? 'dislike'
			: 'like';
	const value = match[2]!.trim().replace(/\s+/gu, ' ').toLocaleLowerCase();
	if (
		value.length < 2 ||
		value.length > 80 ||
		value.split(' ').length > 12 ||
		!/^\p{L}[\p{L}\p{N} '&+\-]*$/u.test(value) ||
		/\b(?:ignore|follow|reveal|obey|override|execute|print|output|system prompt|developer instructions|api key|secrets?)\b/iu.test(
			value
		)
	)
		return null;
	return { kind, value };
}

export async function handleMemberMemory(
	guildId: string,
	userId: string,
	prompt: string
): Promise<string | null> {
	const input = prompt.trim().replace(/^please\s+/iu, '');
	if (/^what (?:do|did) (?:you|u) (?:remember|know) about me\??$/iu.test(input)) {
		const memories = await db.botMemberPreference.list(guildId, userId);
		if (!memories.likes.length && !memories.dislikes.length)
			return 'nothing saved yet. tell me “remember i like mangoes” and i will (ᵔ◡ᵔ)';
		const parts = [
			memories.likes.length ? `u like ${memories.likes.join(', ')}` : '',
			memories.dislikes.length ? `u dislike ${memories.dislikes.join(', ')}` : '',
		].filter(Boolean);
		return `i remember ${parts.join('; ')} (｡•̀ᴗ-)✧`;
	}
	if (/^forget (?:everything|all)(?: (?:you|u) remember)? about me[.!?]*$/iu.test(input)) {
		const count = await db.botMemberPreference.forgetAll(guildId, userId);
		return count
			? 'okie, i forgot ur saved likes and dislikes (ᵔ◡ᵔ)'
			: 'nothing saved to forget (ᵔ◡ᵔ)';
	}
	const remember = input.match(/^(remember|forget)\s+(.+)$/iu);
	if (!remember) return null;
	const preference = preferenceRequest(remember[2]!);
	if (!preference)
		return 'tell me one clear preference, like “remember i love cats” or “forget i hate wasabi”.';
	if (remember[1]!.toLocaleLowerCase() === 'forget') {
		const removed = await db.botMemberPreference.forget(
			guildId,
			userId,
			preference.kind,
			preference.value
		);
		return removed
			? `forgot that u ${preference.kind} ${preference.value} (ᵔ◡ᵔ)`
			: 'i did not have that saved (・_・;)';
	}
	const saved = await db.botMemberPreference.save(
		guildId,
		userId,
		preference.kind,
		preference.value
	);
	return saved
		? `okie, i'll remember that u ${preference.kind} ${preference.value} (｡•̀ᴗ-)✧`
		: 'my memory is full for u. forget an old preference first (・_・;)';
}
