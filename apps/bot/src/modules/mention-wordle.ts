import type { GuildMember, Message } from 'discord.js';
import { WORDLE_BOT_ID } from '@/environment';
import { db } from '@/db';

const SUSPICION = /\b(?:cheat(?:ing|er|ers|s)?|sus(?:picious)?|legit|hacking)\b/iu;
const WORDLE_CONTEXT = /\bwordle\b/iu;

function playerName(prompt: string): string | null {
	const patterns = [
		/\b(?:do\s+(?:you|u)\s+think|think|reckon)\s+(.+?)\s+(?:is|was|might be)\s+(?:cheating|a cheater|sus|suspicious|legit)\b/iu,
		/\b(?:is|was|are)\s+(.+?)\s+(?:cheating|a cheater|sus|suspicious|legit)\b/iu,
		/^\s*(.+?)\s+(?:cheating|a cheater|sus|suspicious|legit)\b/iu,
	];
	const name = patterns.map((pattern) => prompt.match(pattern)?.[1]?.trim()).find(Boolean);
	return name?.replace(/[?!.\s]+$/gu, '').trim() || null;
}

async function namedPlayer(message: Message<true>, prompt: string): Promise<GuildMember | null> {
	const name = playerName(prompt);
	if (!name) return null;
	const matches = await message.guild.members.fetch({ query: name, limit: 100 }).catch(() => null);
	if (!matches) return null;
	const normalized = name.toLocaleLowerCase();
	const exact = matches.filter((member) =>
		[member.displayName, member.user.username, member.user.globalName]
			.filter((value): value is string => !!value)
			.some((value) => value.toLocaleLowerCase() === normalized)
	);
	return exact.size === 1 ? exact.first()! : null;
}

function displayName(member: GuildMember): string {
	return member.displayName.replace(/([\\`*_{}\[\]()#+.!>|~-])/gu, '\\$1').slice(0, 80);
}

export async function answerWordleSuspicion(
	message: Message<true>,
	prompt: string
): Promise<string | null> {
	if (!SUSPICION.test(prompt)) return null;
	const referenced = message.reference?.messageId
		? await message.fetchReference().catch(() => null)
		: null;
	const aboutWordle =
		WORDLE_CONTEXT.test(prompt) ||
		(referenced &&
			(referenced.author.id === WORDLE_BOT_ID || WORDLE_CONTEXT.test(referenced.content)));
	if (!aboutWordle) return null;

	const mentioned = message.mentions.users
		.filter((user) => user.id !== message.client.user.id && user.id !== WORDLE_BOT_ID)
		.first();
	let player = mentioned
		? await message.guild.members.fetch(mentioned.id).catch(() => null)
		: await namedPlayer(message, prompt);
	if (!player && referenced) {
		const referencedPlayers = referenced.mentions.users.filter(
			(user) => user.id !== message.client.user.id && user.id !== WORDLE_BOT_ID
		);
		if (referencedPlayers.size === 1)
			player = await message.guild.members.fetch(referencedPlayers.first()!.id).catch(() => null);
	}
	if (!player) return 'which Wordle player? @ them and ill investigate this extremely serious case';

	const { player: stats, server, recentScores } = await db.wordle.getPlayerComparison(
		message.guild.id,
		player.id
	);
	const name = displayName(player);
	if (!stats.games) return `i dont have any Wordle results for ${name} yet. my detective board is empty`;

	const playerAverage = stats.averageScore?.toFixed(2) ?? 'no solves yet';
	const serverAverage = server.averageScore?.toFixed(2);
	const comparison = serverAverage
		? `; everyone else here averages ${serverAverage}/6`
		: '';
	const recentSolved = recentScores.filter((score) => score >= 1 && score <= 6);
	const recentQuick = recentSolved.filter((score) => score <= 3).length;
	const recentAverage = recentSolved.length
		? (recentSolved.reduce((sum, score) => sum + score, 0) / recentSolved.length).toFixed(2)
		: null;
	const recent = recentScores.length
		? ` last ${recentScores.length}: ${recentQuick} quick solves${recentAverage ? `, ${recentAverage}/6 average` : ''}.`
		: '';
	const evidence = `${stats.games} games, ${stats.solved} solved, ${stats.quickSolves} in 3 guesses or less, ${playerAverage}${stats.averageScore !== null ? '/6 average' : ''}${comparison}.${recent}`;
	if (stats.games < 5)
		return `yeah definitely cheating. ${name} has ${evidence} tiny sample tho, im joking 😭`;
	if (
		stats.averageScore !== null &&
		server.averageScore !== null &&
		stats.averageScore >= server.averageScore + 0.4
	)
		return `yeah definitely cheating... at making Wordle look hard. ${name} has ${evidence} case dismissed (¬_¬)`;
	return `yeah definitely cheating. ${name} has ${evidence} lock them up (im joking, scores alone cant prove cheating)`;
}
