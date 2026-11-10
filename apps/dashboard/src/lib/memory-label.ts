// Small muted label shown next to a saved fact: who said it, and when it applies.
const MONTHS = 'jan feb mar apr may jun jul aug sep oct nov dec'.split(' ');

type LabelFact = {
	source: string;
	kind: string;
	saidByName: string;
	createdAt: Date | string;
	expiresAt: Date | string | null;
};

const monthYear = (date: Date) => `${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;

export function factLabel(fact: LabelFact): string {
	const created = new Date(fact.createdAt);
	const parts: string[] = [];
	if (fact.source === 'friend' && fact.saidByName) parts.push(`from ${fact.saidByName}`);
	if (fact.expiresAt) {
		const until = new Date(fact.expiresAt);
		parts.push(
			`${fact.kind === 'plan' ? 'plan until' : 'until'} ${until.getUTCDate()} ${MONTHS[until.getUTCMonth()]}`
		);
	} else parts.push(monthYear(created));
	return parts.join(', ');
}
