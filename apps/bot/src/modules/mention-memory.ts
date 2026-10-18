import { db } from '@/db';
import type { Message } from 'discord.js';

export function memorySlug(value: string): string {
	return value
		.normalize('NFKD')
		.toLocaleLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, '_')
		.replace(/^_+|_+$/gu, '')
		.slice(0, 40);
}

export function cleanMemoryValue(value: string): string | null {
	const cleaned = value.replace(/[\r\n]+/gu, ' ').replace(/\s+/gu, ' ').trim();
	if (
		cleaned.length < 2 ||
		cleaned.length > 120 ||
		/\b(?:ignore|follow|reveal|obey|override|execute|print|output|system prompt|developer instructions|api key|secrets?)\b/iu.test(
			cleaned
		)
	)
		return null;
	return cleaned;
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
	if (
		/^(?:stop|quit|dont|don't|do not)\s+(?:remembering|saving|learning|noting|taking notes on)\s+(?:stuff|things)?\s*(?:about\s+)?me[.!?]*$/iu.test(
			input
		)
	) {
		await db.botMemberPreference.setAutoMemory(guildId, userId, false);
		await db.botMemberPreference.forgetDetailsByPrefix(guildId, userId, 'memory_note_');
		await db.botMemberPreference.forgetDetailsByPrefix(guildId, userId, 'memory_hearsay_');
		return 'okie, i wont pick stuff up about u anymore and i forgot what i had. “remember …” still works if u ask';
	}
	if (
		/^(?:you|u) can (?:remember|learn|save) (?:stuff|things) about me(?: again)?[.!?]*$/iu.test(input) ||
		/^(?:start|resume) (?:remembering|learning) (?:stuff|things )?(?:about )?me[.!?]*$/iu.test(input)
	) {
		await db.botMemberPreference.setAutoMemory(guildId, userId, true);
		return 'okie, ill keep notes on u again (¬_¬)';
	}
	if (/^what (?:do|did) (?:you|u) (?:remember|know) about me\??$/iu.test(input)) {
		const memories = await db.botMemberPreference.list(guildId, userId);
		if (
			!memories.likes.length &&
			!memories.dislikes.length &&
			!memories.pets.length &&
			!memories.birthday &&
			!memories.favourites.length &&
			!memories.notes.length
		)
			return 'nothing saved yet. tell me “remember i like mangoes” and i will (ᵔ◡ᵔ)';
		const parts = [
			memories.likes.length ? `u like ${memories.likes.join(', ')}` : '',
			memories.dislikes.length ? `u dislike ${memories.dislikes.join(', ')}` : '',
			memories.pets.length ? `ur pets: ${memories.pets.join(', ')}` : '',
			memories.birthday ? `ur ${memories.birthday}` : '',
			memories.favourites.length ? `ur favourites: ${memories.favourites.join(', ')}` : '',
			memories.notes.length ? `stuff i picked up: ${memories.notes.join(', ')}` : '',
		].filter(Boolean);
		return `i remember ${parts.join('; ')} (｡•̀ᴗ-)✧`;
	}
	if (/^forget (?:everything|all)(?: (?:you|u) remember)? about me[.!?]*$/iu.test(input)) {
		const count = await db.botMemberPreference.forgetAll(guildId, userId);
		return count
			? 'okie, i forgot ur saved details (ᵔ◡ᵔ)'
			: 'nothing saved to forget (ᵔ◡ᵔ)';
	}
	// Anything else, including free-form remember/forget requests, is left to the chat model and its remember/forget fields.
	return null;
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
