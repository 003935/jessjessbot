import { command } from '$app/server';
import { throwIfNotLoggedIn } from './server/permission.utils';
import { db } from './server/db';
import { error } from '@sveltejs/kit';
import * as v from 'valibot';
import { PERSONALITY_LIMITS as L } from '@repo/database/defaults';

// jjb's global voice affects every server, so only the dashboard's own site admin may change it.

const Text = (max: number) => v.pipe(v.string(), v.trim(), v.maxLength(max));
const Preference = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(L.preferenceLength));
const Preferences = v.pipe(v.array(Preference), v.maxLength(L.preferenceItems));

const VoiceSchema = v.object({
	identity: Text(L.identity),
	style: Text(L.style),
	rules: Text(L.rules),
	examples: Text(L.examples),
	emoji: Text(L.emoji),
	foodTastes: Text(L.foodTastes),
	likes: Preferences,
	dislikes: Preferences,
});

export const editVoice = command(VoiceSchema, async (input) => {
	const user = throwIfNotLoggedIn();
	if (user.role !== 'admin') error(403, 'Only the site admin can change jjb’s voice');
	// Blank fields are stored as null, which means "use her default".
	await db.botVoice.set({
		identity: input.identity || null,
		style: input.style || null,
		rules: input.rules || null,
		examples: input.examples || null,
		emoji: input.emoji || null,
		food_tastes: input.foodTastes || null,
		likes: input.likes,
		dislikes: input.dislikes,
		updatedBy: user.id,
	});
});
