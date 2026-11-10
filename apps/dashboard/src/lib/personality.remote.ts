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

const FACT_PREFIX = 'memory_fact_';

// Own account or a server admin; nobody else may touch a member's memory.
async function requireSelfOrAdmin(guildId: string, userId: string): Promise<void> {
	const user = throwIfNotLoggedIn();
	const { isAdmin, discordID } = await getDiscordAcc(user, guildId);
	if (!isAdmin && discordID !== userId) error(403, 'Not authorized');
}

export const forgetUserNote = command(
	v.object({
		guildId: v.string(),
		userId: v.string(),
		kind: v.pipe(v.string(), v.startsWith('memory_')),
	}),
	async ({ guildId, userId, kind }) => {
		await requireAdmin(guildId);
		if (kind.startsWith(FACT_PREFIX)) {
			const id = kind.slice(FACT_PREFIX.length);
			const fact = await db.botMemory.get(guildId, id);
			if (!fact || fact.subjectId !== userId) error(404, 'Already gone');
			await db.botMemory.forget(guildId, id);
		} else await db.botMemberPreference.forgetDetail(guildId, userId, kind);
		await db.botReview.dropFor(guildId, 'note', userId, kind);
	}
);

export const forgetServerFact = command(
	v.object({ guildId: v.string(), id: v.string() }),
	async ({ guildId, id }) => {
		await requireAdmin(guildId);
		const fact = await db.botMemory.get(guildId, id);
		if (!fact || fact.subjectId !== '') error(404, 'Already gone');
		await db.botMemory.forget(guildId, id);
		await db.botReview.dropFor(guildId, 'note', '', `${FACT_PREFIX}${id}`);
	}
);

// Self view: a member (or a server admin) deletes one fact about that member.
export const forgetMyFact = command(
	v.object({ guildId: v.string(), userId: v.string(), id: v.string() }),
	async ({ guildId, userId, id }) => {
		await requireSelfOrAdmin(guildId, userId);
		const fact = await db.botMemory.get(guildId, id);
		if (!fact || fact.subjectId !== userId) error(404, 'Already gone');
		await db.botMemory.forget(guildId, id);
		await db.botReview.dropFor(guildId, 'note', userId, `${FACT_PREFIX}${id}`);
	}
);

export const setMyAutoMemory = command(
	v.object({ guildId: v.string(), userId: v.string(), enabled: v.boolean() }),
	async ({ guildId, userId, enabled }) => {
		await requireSelfOrAdmin(guildId, userId);
		await db.botMemberPreference.setAutoMemory(guildId, userId, enabled);
	}
);

export const forgetEverythingAboutMe = command(
	v.object({ guildId: v.string(), userId: v.string() }),
	async ({ guildId, userId }) => {
		await requireSelfOrAdmin(guildId, userId);
		await db.botMemberPreference.forgetAll(guildId, userId);
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
	else if (flag.key.startsWith(FACT_PREFIX))
		await db.botMemory.forget(guildId, flag.key.slice(FACT_PREFIX.length));
	else await db.botMemberPreference.forgetDetail(guildId, flag.userId, flag.key);
	await db.botReview.deleteFlag(guildId, id);
});

// Keeps it; later reviews leave it alone unless it changes.
export const keepFlagged = command(FlagSchema, async ({ guildId, id }) => {
	await requireAdmin(guildId);
	if (!(await db.botReview.keep(guildId, id))) error(404, 'Already handled');
});
