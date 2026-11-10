import { command } from '$app/server';
import { getDiscordAcc, throwIfNotLoggedIn } from './server/permission.utils';
import { db } from './server/db';
import { error } from '@sveltejs/kit';
import * as v from 'valibot';
import { cleanLore, PERSONALITY_LIMITS as L } from '@repo/database/defaults';

const LoreSchema = v.object({
	guildId: v.string(),
	lore: v.pipe(v.string(), v.maxLength(L.lore)),
});

async function requireAdmin(guildId: string): Promise<string> {
	const user = throwIfNotLoggedIn();
	const { isAdmin, discordID } = await getDiscordAcc(user, guildId);
	if (!isAdmin) error(403, 'Not authorized');
	return discordID;
}

// Blank lore is stored as null: she just has no lore for this server.
export const editLore = command(LoreSchema, async (input) => {
	await requireAdmin(input.guildId);
	await db.config.setConfig(input.guildId, { bot_lore: cleanLore(input.lore) });
});

export const forgetOpinion = command(
	v.object({ guildId: v.string(), topic: v.string() }),
	async ({ guildId, topic }) => {
		await requireAdmin(guildId);
		await db.botOpinion.forget(guildId, topic);
		await db.botReview.dropFor(guildId, 'opinion', '', topic);
	}
);

export const forgetUserNote = command(
	v.object({
		guildId: v.string(),
		userId: v.string(),
		kind: v.pipe(v.string(), v.startsWith('memory_')),
	}),
	async ({ guildId, userId, kind }) => {
		await requireAdmin(guildId);
		await db.botMemberPreference.forgetDetail(guildId, userId, kind);
		await db.botReview.dropFor(guildId, 'note', userId, kind);
	}
);

export const forgetAllOpinions = command(v.object({ guildId: v.string() }), async ({ guildId }) => {
	await requireAdmin(guildId);
	await db.botOpinion.forgetAll(guildId);
	await db.botReview.dropAllFor(guildId, 'opinion');
});

const FlagSchema = v.object({ guildId: v.string(), id: v.number() });

// Deletes the note or opinion the weekly review flagged.
export const deleteFlagged = command(FlagSchema, async ({ guildId, id }) => {
	await requireAdmin(guildId);
	const flag = await db.botReview.getFlag(guildId, id);
	if (!flag) error(404, 'Already handled');
	if (flag.target === 'opinion') await db.botOpinion.forget(guildId, flag.key);
	else await db.botMemberPreference.forgetDetail(guildId, flag.userId, flag.key);
	await db.botReview.deleteFlag(guildId, id);
});

// Keeps it; later reviews leave it alone unless it changes.
export const keepFlagged = command(FlagSchema, async ({ guildId, id }) => {
	await requireAdmin(guildId);
	if (!(await db.botReview.keep(guildId, id))) error(404, 'Already handled');
});
