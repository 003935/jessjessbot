type Turn = { role: 'user' | 'assistant'; content: string };

// After a few dozen of her own replies in history, the strongest signal in the prompt is
// her own previous output and every reply copies its shape. Keep her latest few and drop
// the rest; what people said stays in full. (A placeholder like "[jjb replied]" in their
// place gets copied into replies.)
export function collapseOwnReplies<T extends Turn>(turns: T[], keep = 6): T[] {
	let seen = 0;
	return turns
		.toReversed()
		.filter((turn) => turn.role !== 'assistant' || ++seen <= keep)
		.toReversed();
}
