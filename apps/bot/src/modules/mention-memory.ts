import { db } from '@/db';
import type { Message } from 'discord.js';

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
	const nicknameRequest = input.match(/^(?:call me|my nickname is)\s+(.+?)(?:\s+now)?\s*[.!?]*$/iu);
	if (nicknameRequest) {
		const nickname = nicknameRequest[1]!.trim().replace(/\s+/gu, ' ').toLocaleLowerCase();
		if (!/^[\p{L}\p{N}][\p{L}\p{N}_ '-]{1,29}$/u.test(nickname) || nickname.split(' ').length > 3)
			return 'pick a short nickname, like “call me chocbob”';
		await db.botMemberPreference.setNickname(guildId, userId, nickname);
		return `okie, ${nickname} it is. i actually saved it this time (¬_¬)`;
	}
	if (/^(?:forget|remove) (?:my )?nickname[.!?]*$/iu.test(input)) {
		const oldNickname = await db.botMemberPreference.getNickname(guildId, userId);
		if (!oldNickname) return 'i dont have a nickname saved for u';
		await db.botMemberPreference.clearNickname(guildId, userId);
		return 'okie, forgot ur nickname';
	}
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
			? 'okie, i forgot ur saved details (ᵔ◡ᵔ)'
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

export async function answerNicknameQuestion(message: Message<true>, prompt: string): Promise<string | null> {
	const taggedPerson = prompt.trim().match(/^(?:what (?:do|should) i call|what(?:'s| is) (?:the )?name of)\s+<@!?(\d+)>\s*[?!.,]*$/iu);
	if (taggedPerson) {
		const userId = taggedPerson[1]!;
		if (userId === message.client.user.id || !message.mentions.users.has(userId)) return null;
		const member = await message.guild.members.fetch(userId).catch(() => null);
		if (!member) return 'i cant find that person here';
		const nickname = await db.botMemberPreference.getNickname(message.guildId, userId);
		return nickname
			? `${nickname}. ${member.displayName} asked me to call them that (¬_¬)`
			: `${member.displayName} for now`;
	}
	const match = prompt.trim().match(/^who(?:'?s| is)\s+([\p{L}\p{N}_ '-]{2,30})\s*[?!.,]*$/iu);
	if (!match) return null;
	const nickname = match[1]!.trim().toLocaleLowerCase();
	const ids = await db.botMemberPreference.findNicknameUsers(message.guildId, nickname);
	if (!ids.length) return null;
	const members = await Promise.all(ids.map((id) => message.guild.members.fetch(id).catch(() => null)));
	const names = members.map((member) => member?.displayName).filter((name): name is string => !!name);
	if (!names.length) return null;
	return names.length === 1
		? `${nickname} is ${names[0]} (¬_¬)`
		: `${nickname}? ${names.join(' and ')} both asked me to use that name`;
}
