const blockedWords = (process.env.OUTPUT_BLOCKED_WORDS ?? '')
	.split(',')
	.map((word) => word.trim().normalize('NFKC'))
	.filter(Boolean);

const blockedOutput = blockedWords.length
	? new RegExp(
			`(?<![\\p{L}\\p{N}])(?:${blockedWords
				.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
				.join('|')})(?![\\p{L}\\p{N}])`,
			'iu'
		)
	: null;

export function filterBotOutput(content: string): string {
	if (!blockedOutput) return content;
	const visible = content.normalize('NFKC').replace(/\p{Default_Ignorable_Code_Point}/gu, '');
	if (!blockedOutput.test(visible)) return content;
	return "I can't respond to that.";
}
