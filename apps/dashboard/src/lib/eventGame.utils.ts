import * as v from 'valibot';

export const EventGame_Schema = v.object({
	name: v.pipe(
		v.string(),
		v.transform((value) => value.trim()),
		v.nonEmpty('Game name cannot be empty')
	),
	icon: v.pipe(
		v.string(),
		v.transform((value) => (value.length === 0 ? null : value))
	),
});

export type EventGame = v.InferOutput<typeof EventGame_Schema>;
