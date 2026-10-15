export function escapeHallMarkdown(text: string): string {
	return text.replace(
		/(<a?:[\w]+:\d+>)|([\\`*_{}\[\]()#+.!>|~-])/gu,
		(_match, emoji: string | undefined, character: string | undefined) => emoji ?? `\\${character}`
	);
}
