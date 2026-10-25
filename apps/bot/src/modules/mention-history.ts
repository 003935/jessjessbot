type Turn = { role: 'user' | 'assistant'; content: string };

export const COLLAPSED_REPLY = '[jjb replied]';

// After a few dozen of her own replies in history, the strongest signal in the prompt is
// her own previous output and every reply copies its shape. Keep her latest few verbatim
// and hide the rest; what people said stays in full.
export function collapseOwnReplies<T extends Turn>(turns: T[], keep = 6): T[] {
	let seen = 0;
	return turns
		.toReversed()
		.map((turn) =>
			turn.role === 'assistant' && ++seen > keep ? { ...turn, content: COLLAPSED_REPLY } : turn
		)
		.toReversed();
}
