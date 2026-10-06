export const JESS_USER_ID = '718924549692850319';

// Only explicit questions about who made jjb. Loose "you ... mom" matching caught
// ordinary chat like "my mom said you could stay over".
const SELF = String.raw`(?:you|u|jjb|jessjessbot|this bot|the bot)`;
const YOUR = String.raw`(?:your|ur|jjb'?s|jessjessbot'?s|the bot'?s)`;
const ROLE = String.raw`(?:creator|maker|mom|mum|mother|mommy|mummy|dev|developer|owner|parent)`;
const CREATOR_PATTERNS = [
	new RegExp(String.raw`\bwho\s+(?:made|created|built|coded|programmed|owns|wrote)\s+${SELF}\b`, 'iu'),
	new RegExp(String.raw`\bwho(?:'?s|\s+is|\s+r|\s+are)\s+${YOUR}\s+${ROLE}s?\b`, 'iu'),
	new RegExp(String.raw`^\s*(?:is|isn'?t|isnt|are|aren'?t|was)\b.{0,60}\b${YOUR}\s+${ROLE}\b`, 'iu'),
	new RegExp(String.raw`\b(?:are|r)\s+${SELF}\s+(?:jess(?:ica)?'?s?|her|their)\s+(?:daughter|kid|child|bot)\b`, 'iu'),
	new RegExp(String.raw`\bwho\s+(?:is|'?s)\s+${SELF}\s+(?:made|created|built)\s+by\b`, 'iu'),
];

export function isCreatorQuestion(prompt: string): boolean {
	return CREATOR_PATTERNS.some((pattern) => pattern.test(prompt));
}

export function answerCreatorQuestion(): string {
	return `jess (jessica) <@${JESS_USER_ID}> made me. she's my mom and im her daughter (¬_¬)`;
}
