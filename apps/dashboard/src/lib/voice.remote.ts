import { command } from '$app/server';
import { throwIfNotLoggedIn } from './server/permission.utils';
import { db } from './server/db';
import { error } from '@sveltejs/kit';
import * as v from 'valibot';
import { PERSONALITY_LIMITS as L } from '@repo/database/defaults';

// jjb's personality affects every server, so only the dashboard's own site admin may change it.

const VoiceSchema = v.object({
	personality: v.pipe(v.string(), v.trim(), v.maxLength(L.personality)),
});

export const editVoice = command(VoiceSchema, async (input) => {
	const user = throwIfNotLoggedIn();
	if (user.role !== 'admin') error(403, 'Only the site admin can change jjb’s personality');
	// Blank is stored as null, which means "use her default".
	await db.botVoice.set({ personality: input.personality || null, updatedBy: user.id });
});
