import { db } from '@/db';
import type { Message } from 'discord.js';

type PreferenceKind = 'like' | 'dislike';
type SavedDetail = { kind: string; value: string };

function memorySlug(value: string): string {
	return value
		.normalize('NFKD')
		.toLocaleLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, '_')
		.replace(/^_+|_+$/gu, '')
		.slice(0, 40);
}

function cleanMemoryValue(value: string): string | null {
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

function rememberedPayload(input: string): string | null {
	const explicit = input.match(/^(?:remember|save)\s+(?:that\s+)?(.+?)\s*[.!?]*$/iu);
	if (explicit) return explicit[1]!.trim();
	const marker = /\b(?:remember|save)\s+(?:it|that|this)\b/iu.exec(input);
	if (!marker || marker.index === undefined) return null;
	return `${input.slice(0, marker.index)} ${input.slice(marker.index + marker[0].length)}`
		.replace(/[.!?,;]+/gu, ' ')
		.replace(/\s+/gu, ' ')
		.trim();
}

function editedPayload(input: string): string | null {
	let match = input.match(/^(?:edit|update|change)\s+(?:my\s+)?birthday\s+(?:to|is)\s+(.+?)\s*[.!?]*$/iu);
	if (match) return `my birthday is ${match[1]}`;
	match = input.match(
		/^(?:edit|update|change)\s+(?:my\s+)?favou?rite\s+([\p{L} -]{2,24}?)\s+(?:to|is)\s+(.+?)\s*[.!?]*$/iu
	);
	if (match) return `my favourite ${match[1]!.trim()} is ${match[2]}`;
	match = input.match(
		/^(?:edit|update|change)\s+(?:my\s+)?(pet|cat|dog)\s+([\p{L}\p{N}'_-][\p{L}\p{N} '\-_]{0,38}?)\s*(?:to|:)\s*(.+?)\s*[.!?]*$/iu
	);
	if (match) return `${match[2]!.trim()} is my ${match[1]}; ${match[3]}`;
	return null;
}

function petDetail(payload: string): SavedDetail | null {
	const species = '(?:cat|dog|pet|kitten|puppy|rabbit|bird|hamster|guinea pig|fish|tortoise|turtle)';
	const direct = payload.match(
		new RegExp(`^([\\p{L}\\p{N}][\\p{L}\\p{N} '\\-_]{0,38}?)\\s+is\\s+my\\s+(${species})\\b([\\s\\S]*)$`, 'iu')
	);
	const reversed = payload.match(
		new RegExp(`^my\\s+(${species})\\s+([\\p{L}\\p{N}][\\p{L}\\p{N} '\\-_]{0,38}?)(?:\\s+is\\b([\\s\\S]*))?$`, 'iu')
	);
	const rawName = direct?.[1]?.trim() ?? reversed?.[2]?.trim();
	const animal = direct?.[2]?.toLocaleLowerCase() ?? reversed?.[1]?.toLocaleLowerCase();
	const tail = direct?.[3] ?? reversed?.[3] ?? '';
	const name = rawName ? cleanMemoryValue(rawName) : null;
	if (!name || !animal) return null;
	const detail = cleanMemoryValue(tail.replace(/^[\s,;:.!-]+/u, ''));
	const value = `${name} is my ${animal}${detail ? `; ${detail}` : ''}`;
	const key = memorySlug(name);
	return key ? { kind: `memory_pet_${key}`, value } : null;
}

function categorizedDetail(payload: string): SavedDetail | null {
	const birthday = payload.match(/^(?:my\s+)?birthday\s+(?:is|falls on)\s+(.+?)\s*[.!?]*$/iu);
	if (birthday) {
		const value = cleanMemoryValue(birthday[1]!);
		return value ? { kind: 'memory_birthday', value: `birthday: ${value}` } : null;
	}
	const favourite = payload.match(
		/^(?:my\s+)?favou?rite\s+([\p{L} -]{2,24}?)\s+(?:is|are)\s+(.+?)\s*[.!?]*$/iu
	);
	if (favourite) {
		const category = memorySlug(favourite[1]!.trim());
		const value = cleanMemoryValue(favourite[2]!);
		return category && value
			? { kind: `memory_favourite_${category}`, value: `favourite ${favourite[1]!.trim()}: ${value}` }
			: null;
	}
	return null;
}

function detailForgetRequest(input: string): { prefix?: string; kind?: string } | null {
	if (/^(?:forget|delete|remove)\s+(?:my\s+)?birthday[.!?]*$/iu.test(input))
		return { kind: 'memory_birthday' };
	if (/^(?:forget|delete|remove)\s+(?:my\s+)?pets?[.!?]*$/iu.test(input))
		return { prefix: 'memory_pet_' };
	if (/^(?:forget|delete|remove)\s+(?:my\s+)?favo?u?rites?[.!?]*$/iu.test(input))
		return { prefix: 'memory_favourite_' };
	const pet = input.match(
		/^(?:forget|delete|remove)\s+(?:(?:my|the)\s+)?(?:pet|cat|dog)\s+([\p{L}\p{N}][\p{L}\p{N} '\-_]{0,38}?)\s*[.!?]*$/iu
	);
	if (pet) {
		const key = memorySlug(pet[1]!);
		return key ? { kind: `memory_pet_${key}` } : null;
	}
	const favourite = input.match(
		/^(?:forget|delete|remove)\s+(?:my\s+)?favou?rite\s+([\p{L} -]{2,24})[.!?]*$/iu
	);
	if (favourite) {
		const category = memorySlug(favourite[1]!.trim());
		return category ? { kind: `memory_favourite_${category}` } : null;
	}
	return null;
}

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
		if (
			!memories.likes.length &&
			!memories.dislikes.length &&
			!memories.pets.length &&
			!memories.birthday &&
			!memories.favourites.length
		)
			return 'nothing saved yet. tell me “remember i like mangoes” and i will (ᵔ◡ᵔ)';
		const parts = [
			memories.likes.length ? `u like ${memories.likes.join(', ')}` : '',
			memories.dislikes.length ? `u dislike ${memories.dislikes.join(', ')}` : '',
			memories.pets.length ? `ur pets: ${memories.pets.join(', ')}` : '',
			memories.birthday ? `ur ${memories.birthday}` : '',
			memories.favourites.length ? `ur favourites: ${memories.favourites.join(', ')}` : '',
		].filter(Boolean);
		return `i remember ${parts.join('; ')} (｡•̀ᴗ-)✧`;
	}
	if (/^forget (?:everything|all)(?: (?:you|u) remember)? about me[.!?]*$/iu.test(input)) {
		const count = await db.botMemberPreference.forgetAll(guildId, userId);
		return count
			? 'okie, i forgot ur saved details (ᵔ◡ᵔ)'
			: 'nothing saved to forget (ᵔ◡ᵔ)';
	}
	const detailForget = detailForgetRequest(input);
	if (detailForget) {
		const count = detailForget.kind
			? Number(await db.botMemberPreference.forgetDetail(guildId, userId, detailForget.kind))
			: await db.botMemberPreference.forgetDetailsByPrefix(guildId, userId, detailForget.prefix!);
		return count
			? 'okie, deleted that from my memory (ᵔ◡ᵔ)'
			: 'i didnt have that saved (・_・;)';
	}
	const payload = editedPayload(input) ?? rememberedPayload(input);
	if (payload) {
		const detail = petDetail(payload) ?? categorizedDetail(payload);
		if (detail) {
			const saved = await db.botMemberPreference.saveDetail(
				guildId,
				userId,
				detail.kind,
				detail.value
			);
			return saved
				? `okie, saved ${detail.value}. i can change or forget it whenever u say (ᵔ◡ᵔ)`
				: 'my memory is full for u. forget an old pet, birthday, or favourite first (・_・;)';
		}
	}
	const remember = input.match(/^(remember|forget)\s+(.+)$/iu);
	if (!remember) return null;
	const preference = preferenceRequest(remember[2]!);
	if (!preference)
		return 'tell me one clear thing to remember, like ur pet, birthday, favourite thing, or “remember i love cats”.';
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
