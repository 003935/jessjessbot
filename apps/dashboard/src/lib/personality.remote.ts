import { command } from '$app/server';
import { getDiscordAcc, throwIfNotLoggedIn } from './server/permission.utils';
import { db } from './server/db';
import { error } from '@sveltejs/kit';
import * as v from 'valibot';
import { PERSONALITY_LIMITS as L } from '@repo/database/defaults';

const Preference = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(40));

const PersonalitySchema = v.object({
	guildId: v.string(),
	personality: v.pipe(v.string(), v.trim(), v.maxLength(1500)),
	likes: v.pipe(v.array(Preference), v.maxLength(15)),
	dislikes: v.pipe(v.array(Preference), v.maxLength(15)),
	lore: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(L.lore)), ''),
});

const CannedLine = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(L.cannedLineLength));
const CannedList = v.pipe(v.array(CannedLine), v.maxLength(L.cannedLines));
const DownLine = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(L.downLineLength));
const DownStage = v.pipe(v.array(DownLine), v.minLength(1), v.maxLength(L.downLines));
const DownScenario = v.pipe(v.array(DownStage), v.minLength(1), v.maxLength(L.downStages));

const CannedLinesSchema = v.object({
	guildId: v.string(),
	greeting: CannedList,
	annoyed: CannedList,
	lazy: CannedList,
	fallback: v.pipe(v.string(), v.trim(), v.maxLength(L.fallback)),
	downLines: v.pipe(
		v.record(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(40)), DownScenario),
		v.check((scenarios) => Object.keys(scenarios).length <= L.downScenarios, 'Too many scenarios')
	),
	memeEnabled: v.boolean(),
	memePrompt: v.pipe(v.string(), v.trim(), v.maxLength(L.meme)),
});

const DiscordId = v.pipe(v.string(), v.regex(/^\d{15,25}$/u));

const MemberBehaviourSchema = v.object({
	guildId: v.string(),
	userId: DiscordId,
	behaviour: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(L.behaviour)),
	whenUpset: v.pipe(v.string(), v.trim(), v.maxLength(L.whenUpset)),
});

async function requireAdmin(guildId: string): Promise<string> {
	const user = throwIfNotLoggedIn();
	const { isAdmin, discordID } = await getDiscordAcc(user, guildId);
	if (!isAdmin) error(403, 'Not authorized');
	return discordID;
}

export const editPersonality = command(PersonalitySchema, async (input) => {
	await requireAdmin(input.guildId);
	await db.config.setConfig(input.guildId, {
		bot_personality: input.personality || null,
		bot_likes: input.likes,
		bot_dislikes: input.dislikes,
		bot_lore: input.lore || null,
	});
});

// Empty lists and blank text are stored as empty/null, which means "use her default".
export const editCannedLines = command(CannedLinesSchema, async (input) => {
	await requireAdmin(input.guildId);
	await db.config.setConfig(input.guildId, {
		bot_greeting_lines: input.greeting,
		bot_annoyed_lines: input.annoyed,
		bot_lazy_lines: input.lazy,
		bot_fallback_reply: input.fallback || null,
		bot_down_lines: Object.keys(input.downLines).length ? input.downLines : null,
		bot_meme_enabled: input.memeEnabled,
		bot_meme_prompt: input.memePrompt || null,
	});
});

export const setMemberBehaviour = command(MemberBehaviourSchema, async (input) => {
	const updatedBy = await requireAdmin(input.guildId);
	await db.botMemberBehaviour.set(input.guildId, input.userId, {
		behaviour: input.behaviour,
		when_upset: input.whenUpset || null,
		updatedBy,
	});
});

export const deleteMemberBehaviour = command(
	v.object({ guildId: v.string(), userId: DiscordId }),
	async ({ guildId, userId }) => {
		await requireAdmin(guildId);
		await db.botMemberBehaviour.delete(guildId, userId);
	}
);

export const forgetOpinion = command(
	v.object({ guildId: v.string(), topic: v.string() }),
	async ({ guildId, topic }) => {
		await requireAdmin(guildId);
		await db.botOpinion.forget(guildId, topic);
	}
);

export const forgetUserNote = command(
	v.object({ guildId: v.string(), userId: v.string(), kind: v.pipe(v.string(), v.startsWith('memory_')) }),
	async ({ guildId, userId, kind }) => {
		await requireAdmin(guildId);
		await db.botMemberPreference.forgetDetail(guildId, userId, kind);
	}
);

export const forgetAllOpinions =command(v.object({ guildId: v.string() }), async ({ guildId }) => {
	await requireAdmin(guildId);
	await db.botOpinion.forgetAll(guildId);
});
