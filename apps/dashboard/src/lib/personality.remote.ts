import { command } from '$app/server';
import { getDiscordAcc, throwIfNotLoggedIn } from './server/permission.utils';
import { db } from './server/db';
import { error } from '@sveltejs/kit';
import * as v from 'valibot';

const Preference = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(40));

const PersonalitySchema = v.object({
	guildId: v.string(),
	personality: v.pipe(v.string(), v.trim(), v.maxLength(1500)),
	likes: v.pipe(v.array(Preference), v.maxLength(15)),
	dislikes: v.pipe(v.array(Preference), v.maxLength(15)),
});

async function requireAdmin(guildId: string) {
	const user = throwIfNotLoggedIn();
	const { isAdmin } = await getDiscordAcc(user, guildId);
	if (!isAdmin) error(403, 'Not authorized');
}

export const editPersonality = command(PersonalitySchema, async (input) => {
	await requireAdmin(input.guildId);
	await db.config.setConfig(input.guildId, {
		bot_personality: input.personality || null,
		bot_likes: input.likes,
		bot_dislikes: input.dislikes,
	});
});

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
