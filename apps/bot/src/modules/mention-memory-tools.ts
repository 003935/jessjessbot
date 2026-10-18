import { db } from '@/db';
import { Logger } from '@/utils';
import { cleanMemoryValue, memorySlug } from '@/modules/mention-memory';
import { cleanNote } from '@/modules/mention-notes';
import type { MemberLookup } from '@/modules/mention-members';

// jjb decides what to remember or forget through reply_chat's remember/forget fields;
// this file checks those untrusted model outputs and is the only chat-path writer of member memory.

const logger = new Logger('MemoryTools');

const KINDS = ['pet', 'birthday', 'favourite', 'like', 'dislike', 'note'] as const;
export type MemoryKind = (typeof KINDS)[number];
export type MemoryChange =
	| { op: 'remember'; about: string | null; kind: MemoryKind; name: string | null; value: string }
	| { op: 'forget'; kind: MemoryKind; name: string | null; value: string | null };
export type MemoryFailure = { reason: 'full' | 'invalid' | 'unknown_member' | 'error'; name?: string };

const MAX_CHANGES = 10;
const MAX_NAME_LENGTH = 40;
const MAX_NOTE_LENGTH = 100;

const KIND_DESCRIPTION =
	'pet (name = pet name, value = species plus optional detail like "cat; very fat"), birthday (value = date), favourite (name = category like "food", value = the thing), like, dislike, or note (value = a short lowercase fact)';

export const MEMORY_TOOL_PROPERTIES = {
	remember: {
		type: 'array',
		description:
			'Details to save, only when someone asks you to remember or update something. Anything you say you saved must be listed here.',
		items: {
			type: 'object',
			properties: {
				about: {
					type: 'string',
					description: 'Omit for the current speaker; otherwise the name they used for another server member',
				},
				kind: { type: 'string', enum: KINDS, description: KIND_DESCRIPTION },
				name: { type: 'string' },
				value: { type: 'string' },
			},
			required: ['kind', 'value'],
		},
	},
	forget: {
		type: 'array',
		description:
			"The current speaker's own saved details to delete, only when they ask. pet without name forgets all their pets.",
		items: {
			type: 'object',
			properties: {
				kind: { type: 'string', enum: KINDS },
				name: { type: 'string' },
				value: { type: 'string' },
			},
			required: ['kind'],
		},
	},
} as const;

function text(value: unknown): string | null {
	return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function isKind(value: unknown): value is MemoryKind {
	return typeof value === 'string' && (KINDS as readonly string[]).includes(value);
}

function cleanName(value: unknown): string | null {
	const name = text(value);
	const cleaned = name ? cleanMemoryValue(name) : null;
	return cleaned && cleaned.length <= MAX_NAME_LENGTH && memorySlug(cleaned) ? cleaned : null;
}

function parseRemember(item: unknown): MemoryChange | null {
	if (!item || typeof item !== 'object') return null;
	const raw = item as Record<string, unknown>;
	if (!isKind(raw.kind)) return null;
	const rawValue = text(raw.value);
	let value = rawValue ? cleanMemoryValue(rawValue) : null;
	if (!value) return null;
	if (raw.kind === 'note' && value.length > MAX_NOTE_LENGTH) return null;
	if (raw.kind === 'like' || raw.kind === 'dislike') value = value.toLocaleLowerCase();
	const needsName = raw.kind === 'pet' || raw.kind === 'favourite';
	const name = needsName ? cleanName(raw.name) : null;
	if (needsName && !name) return null;
	const aboutText = text(raw.about);
	const about = !aboutText || /^me$/iu.test(aboutText) ? null : aboutText.slice(0, MAX_NAME_LENGTH);
	return { op: 'remember', about, kind: raw.kind, name, value };
}

function parseForget(item: unknown): MemoryChange | null {
	if (!item || typeof item !== 'object') return null;
	const raw = item as Record<string, unknown>;
	if (!isKind(raw.kind)) return null;
	const name = raw.kind === 'pet' || raw.kind === 'favourite' ? cleanName(raw.name) : null;
	const rawValue = text(raw.value);
	const value = rawValue ? cleanMemoryValue(rawValue) : null;
	if (raw.kind === 'favourite' && !name) return null;
	if ((raw.kind === 'like' || raw.kind === 'dislike' || raw.kind === 'note') && !value) return null;
	return {
		op: 'forget',
		kind: raw.kind,
		name,
		value: value && (raw.kind === 'like' || raw.kind === 'dislike') ? value.toLocaleLowerCase() : value,
	};
}

function changeKey(change: MemoryChange): string {
	const about = change.op === 'remember' ? (change.about?.toLocaleLowerCase() ?? '') : '';
	// One pet, birthday or favourite slot per name; likes and notes are keyed by their text.
	const slot =
		change.kind === 'pet' || change.kind === 'favourite' || change.kind === 'birthday'
			? memorySlug(change.name ?? '')
			: (change.value ?? '').toLocaleLowerCase();
	return `${change.op}|${about}|${change.kind}|${slot}`;
}

/** Validates the model's remember/forget fields; anything malformed or over the limits is dropped. */
export function parseMemoryChanges(args: { remember?: unknown; forget?: unknown }): {
	changes: MemoryChange[];
	dropped: number;
} {
	const changes: MemoryChange[] = [];
	const seen = new Set<string>();
	let dropped = 0;
	for (const [field, parse] of [
		[args.remember, parseRemember],
		[args.forget, parseForget],
	] as const) {
		if (field === undefined) continue;
		if (!Array.isArray(field)) {
			dropped++;
			continue;
		}
		for (const item of field) {
			const change = parse(item);
			if (!change) {
				dropped++;
				continue;
			}
			const key = changeKey(change);
			if (seen.has(key)) continue;
			if (changes.length >= MAX_CHANGES) {
				dropped++;
				continue;
			}
			seen.add(key);
			changes.push(change);
		}
	}
	return { changes, dropped };
}

function hearsayFact(change: Extract<MemoryChange, { op: 'remember' }>): string {
	switch (change.kind) {
		case 'pet':
			return `has a ${change.value.split(';')[0]!.trim()} called ${change.name}`;
		case 'birthday':
			return `birthday is ${change.value}`;
		case 'favourite':
			return `favourite ${change.name} is ${change.value}`;
		case 'like':
			return `likes ${change.value}`;
		case 'dislike':
			return `dislikes ${change.value}`;
		case 'note':
			return change.value;
	}
}

async function rememberForSpeaker(
	guildId: string,
	userId: string,
	change: Extract<MemoryChange, { op: 'remember' }>
): Promise<MemoryFailure | null> {
	const prefs = db.botMemberPreference;
	let saved: boolean;
	switch (change.kind) {
		case 'pet': {
			const [species, ...rest] = change.value.split(';');
			const detail = rest.join(';').trim();
			saved = await prefs.saveDetail(
				guildId,
				userId,
				`memory_pet_${memorySlug(change.name!)}`,
				`${change.name} is my ${species!.trim()}${detail ? `; ${detail}` : ''}`
			);
			break;
		}
		case 'birthday':
			saved = await prefs.saveDetail(guildId, userId, 'memory_birthday', `birthday: ${change.value}`);
			break;
		case 'favourite':
			saved = await prefs.saveDetail(
				guildId,
				userId,
				`memory_favourite_${memorySlug(change.name!)}`,
				`favourite ${change.name}: ${change.value}`
			);
			break;
		case 'like':
		case 'dislike':
			saved = await prefs.save(guildId, userId, change.kind, change.value);
			break;
		case 'note': {
			const note = cleanNote(change.value);
			if (!note) return { reason: 'invalid' };
			await prefs.saveNotes(guildId, userId, [note]);
			saved = true;
			break;
		}
	}
	return saved ? null : { reason: 'full' };
}

async function forgetForSpeaker(
	guildId: string,
	userId: string,
	change: Extract<MemoryChange, { op: 'forget' }>
): Promise<void> {
	const prefs = db.botMemberPreference;
	switch (change.kind) {
		case 'pet':
			if (change.name) await prefs.forgetDetail(guildId, userId, `memory_pet_${memorySlug(change.name)}`);
			else await prefs.forgetDetailsByPrefix(guildId, userId, 'memory_pet_');
			return;
		case 'birthday':
			await prefs.forgetDetail(guildId, userId, 'memory_birthday');
			return;
		case 'favourite':
			await prefs.forgetDetail(guildId, userId, `memory_favourite_${memorySlug(change.name!)}`);
			return;
		case 'like':
		case 'dislike':
			await prefs.forget(guildId, userId, change.kind, change.value!);
			return;
		case 'note':
			await prefs.forgetNoteValue(guildId, userId, change.value!);
			return;
	}
}

/** Applies validated changes for the speaker; facts about others become attributed notes on them. */
export async function applyMemoryChanges(
	guildId: string,
	speaker: { id: string; displayName: string },
	changes: MemoryChange[],
	resolveMember: (name: string) => Promise<MemberLookup>
): Promise<{ failures: MemoryFailure[] }> {
	const failures: MemoryFailure[] = [];
	for (const change of changes) {
		try {
			if (change.op === 'forget') {
				await forgetForSpeaker(guildId, speaker.id, change);
				continue;
			}
			if (!change.about) {
				const failure = await rememberForSpeaker(guildId, speaker.id, change);
				if (failure) failures.push(failure);
				continue;
			}
			const lookup = await resolveMember(change.about);
			if (lookup.status !== 'found') {
				failures.push({ reason: 'unknown_member', name: change.about });
				continue;
			}
			if (lookup.member.id === speaker.id) {
				const failure = await rememberForSpeaker(guildId, speaker.id, change);
				if (failure) failures.push(failure);
				continue;
			}
			if (!(await db.botMemberPreference.autoMemoryEnabled(guildId, lookup.member.id))) continue;
			const fact = cleanNote(hearsayFact(change));
			const note = fact ? `${speaker.displayName} says: ${fact}` : null;
			if (!note || note.length > MAX_NOTE_LENGTH) {
				failures.push({ reason: 'invalid' });
				continue;
			}
			await db.botMemberPreference.saveNotes(guildId, lookup.member.id, [note]);
		} catch (error) {
			logger.error('Could not apply a memory change', error);
			failures.push({ reason: 'error' });
		}
	}
	return { failures };
}

export function memoryFailureReply(failures: MemoryFailure[]): string {
	const failure = failures[0];
	if (failure?.reason === 'full') return "my memory's full for u, forget an old pet or favourite first (・_・;)";
	if (failure?.reason === 'unknown_member') return `who's ${failure.name}? i couldn't find them here`;
	return "i couldn't save that one (・_・;)";
}

/** Applies the reply's memory changes; if anything failed, her reply becomes an honest one. */
export async function finalizeMemoryReply(
	reply: string,
	changes: MemoryChange[] | undefined,
	dropped: number | undefined,
	apply: (changes: MemoryChange[]) => Promise<{ failures: MemoryFailure[] }>
): Promise<{ reply: string; touchedMemory: boolean }> {
	if (!changes?.length && !dropped) return { reply, touchedMemory: false };
	if (!changes?.length) return { reply: memoryFailureReply([{ reason: 'invalid' }]), touchedMemory: true };
	const { failures } = await apply(changes);
	return { reply: failures.length ? memoryFailureReply(failures) : reply, touchedMemory: true };
}
