import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Logger } from '@/utils';

// What changed about jjb lately, so she can answer "what's new" and joke about the old her.
// Each change is one small file in apps/bot/updates (see the README there).

const logger = new Logger('Updates');

export type Update = { date: string; text: string };

const MAX_SHOWN = 12;
const MAX_AGE_DAYS = 90;
// Always show a few, even after a quiet stretch.
const MIN_SHOWN = 4;
const MAX_TEXT_LENGTH = 400;
const UPDATES_DIR = fileURLToPath(new URL('../../updates/', import.meta.url));

/** Reads the update files, newest first. Files not named like 2026-11-10-something.md are skipped. */
export function loadUpdates(dir = UPDATES_DIR): Update[] {
	try {
		return readdirSync(dir)
			.map((file) => ({ file, date: file.match(/^(\d{4}-\d{2}-\d{2})-.+\.md$/u)?.[1] }))
			.filter((entry): entry is { file: string; date: string } => !!entry.date)
			.sort((a, b) => b.file.localeCompare(a.file))
			.map(({ file, date }) => ({
				date,
				text: readFileSync(`${dir}/${file}`, 'utf8')
					.replace(/\s+/gu, ' ')
					.trim()
					.slice(0, MAX_TEXT_LENGTH),
			}))
			.filter((update) => update.text);
	} catch (error) {
		logger.error('Could not read the updates folder', error);
		return [];
	}
}

let cached: Update[] | null = null;

const ASKS =
	/\b(?:updates?|updated|changelog|patch(?:ed| ?notes)?|features?|what'?s new|what(?:'s| has| did)? changed?|changed|different(?:ly)?|(?:old|new|previous) (?:jjb|you|u|version|personality)|used to|upgrade[sd]?|nerf(?:ed)?|buff(?:ed)?|lobotom\w*|version|rework(?:ed)?)\b/iu;

/** True when the message is about jjb changing, so the list of changes is worth showing her. */
export function asksAboutUpdates(prompt: string): boolean {
	return ASKS.test(prompt);
}

const shortDate = new Intl.DateTimeFormat('en-GB', {
	day: 'numeric',
	month: 'short',
	timeZone: 'UTC',
});

/** "today", "3 days ago", "2 weeks ago (28 Oct)": she gets the day wrong if left to work it out from a date. */
function when(date: string, now: Date): string {
	const day = new Date(`${date}T00:00:00Z`);
	const days = Math.floor(
		(Date.parse(now.toISOString().slice(0, 10)) - day.getTime()) / 86_400_000
	);
	if (days <= 0) return 'today';
	if (days === 1) return 'yesterday';
	if (days < 14) return `${days} days ago`;
	return `${Math.floor(days / 7)} weeks ago (${shortDate.format(day)})`;
}

/** The recent changes, for her prompt. Empty when there are none. */
export function updatesPrompt(
	updates: Update[] = (cached ??= loadUpdates()),
	now = new Date()
): string {
	const cutoff = new Date(now.getTime() - MAX_AGE_DAYS * 86_400_000).toISOString().slice(0, 10);
	const shown = updates
		.filter((update, index) => index < MIN_SHOWN || update.date >= cutoff)
		.slice(0, MAX_SHOWN);
	if (!shown.length) return '';
	const lines = shown.map((update) => `- ${when(update.date, now)}: ${update.text}`);
	return `What Jess changed about you (jjb) lately, newest first. This is real and it happened to you, so you know it the way you know your own life. It is everything that changed: anything not listed here did not happen.\n${lines.join('\n')}`;
}
