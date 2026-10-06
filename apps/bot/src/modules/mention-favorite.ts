import type { Message } from 'discord.js';
import { db } from '@/db';
import { rankFavorites } from '@/modules/favorite-ranking';

export function isFavoriteUserRequest(prompt: string): boolean {
	return /\b(?:favo(?:u)?rite|best)\b.*\b(?:user|person|member|friend)\b/iu.test(prompt) &&
		/\b(?:who|which|name|pick|tell|ur|your)\b/iu.test(prompt);
}

export async function answerFavoriteUser(
	message: Message<true>,
	recentUserIds: ReadonlySet<string>
): Promise<string> {
	const candidates = rankFavorites(
		await db.botRelationship.favoriteCandidates(message.guildId),
		recentUserIds,
		message.author.id
	);
	for (const candidate of candidates.slice(0, 20)) {
		const member = await message.guild.members.fetch(candidate.userId).catch(() => null);
		if (!member || member.user.bot) continue;
		const name = member.displayName.replace(/([\\`*_{}\[\]()#+.!>|~-])/gu, '\\$1').slice(0, 80);
		return candidate.userId === message.author.id
			? `u, obviously. dont make me say it twice (¬_¬)`
			: `${name}. no i will not be taking appeals at this time (¬_¬)`;
	}
	return 'u for now. the competition has been shockingly quiet';
}
