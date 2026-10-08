export function londonClock(now: Date) {
	const parts = new Intl.DateTimeFormat('en-GB', {
		timeZone: 'Europe/London',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23',
	}).formatToParts(now);
	const part = (key: string) => parts.find((p) => p.type === key)!.value;
	return {
		day: `${part('year')}-${part('month')}-${part('day')}`,
		minute: Number(part('hour')) * 60 + Number(part('minute')),
	};
}

export function randomMinute(currentMinute: number, random = Math.random) {
	return currentMinute + Math.floor(random() * (1440 - currentMinute));
}
