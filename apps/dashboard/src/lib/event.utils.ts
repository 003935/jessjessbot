import * as v from 'valibot';

export const Custom_Schema = v.object({
	guildId: v.string(),
	time: v.pipe(v.string(), v.isoTimestamp()),
	gameName: v.pipe(v.string(), v.trim(), v.nonEmpty('Choose a game')),
	name: v.pipe(v.string(), v.trim()),
});

export type Custom = v.InferOutput<typeof Custom_Schema>;
