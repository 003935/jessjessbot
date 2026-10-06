export const JESS_USER_ID = '718924549692850319';

export function isCreatorQuestion(prompt: string): boolean {
	const text = prompt.toLocaleLowerCase();
	return /\b(?:your|ur|you|u|jjb|jessjessbot|bot)\b.{0,100}\b(?:creator|created|made|mom|mum|mother|parent|daughter)\b/u.test(text) ||
		/\b(?:creator|created|made|mom|mum|mother|parent|daughter)\b.{0,100}\b(?:your|ur|you|u|jjb|jessjessbot|bot)\b/u.test(text);
}

export function answerCreatorQuestion(): string {
	return `jess (jessica) <@${JESS_USER_ID}> made me. she's my mom and im her daughter (¬_¬)`;
}
