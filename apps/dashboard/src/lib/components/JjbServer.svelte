<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { CheckIcon, SaveIcon, Trash2Icon, UsersIcon, XIcon } from '@lucide/svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { toast } from 'svelte-sonner';
	import { PERSONALITY_LIMITS } from '@repo/database/defaults';
	import {
		editLore,
		deleteFlagged,
		forgetAllOpinions,
		forgetOpinion,
		forgetUserNote,
		keepFlagged,
	} from '$lib/personality.remote';

	type ReviewFlag = {
		id: number;
		target: 'note' | 'opinion';
		userId: string;
		key: string;
		text: string;
		reason: string;
	};

	type SavedUser = {
		id: string;
		name: string;
		avatar: string | null;
		loot: Array<{ itemName: string; quantity: number }>;
		nickname: string | null;
		notes: Array<{ kind: string; value: string }>;
		pets: string[];
		leagueAccounts: Array<{ gameName: string | null; tagline: string | null; region: string }>;
		wordleGames: number;
		customSignups: number;
	};

	let {
		guildId,
		lore: initialLore,
		savedUsers,
		opinions: initialOpinions,
		review,
		reviewFlags: initialFlags,
		canResetLoot,
	}: {
		guildId: string;
		lore: string;
		savedUsers: SavedUser[];
		opinions: Array<{ topic: string; opinion: string }>;
		review: {
			createdAt: string;
			periodStart: string;
			periodEnd: string;
			summary: string;
			report: string;
		} | null;
		reviewFlags: ReviewFlag[];
		canResetLoot: boolean;
	} = $props();

	// svelte-ignore state_referenced_locally
	let flags = $state(initialFlags);
	let showReport = $state(false);
	const nameOf = (userId: string) => savedUsers.find((user) => user.id === userId)?.name ?? userId;
	const day = (iso: string) =>
		new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

	async function resolveFlag(flag: ReviewFlag, action: 'delete' | 'keep') {
		try {
			if (action === 'delete') {
				await deleteFlagged({ guildId, id: flag.id });
				if (flag.target === 'note') forgottenNotes.add(`${flag.userId}:${flag.key}`);
				else opinions = opinions.filter((entry) => entry.topic !== flag.key);
			} else {
				await keepFlagged({ guildId, id: flag.id });
			}
			flags = flags.filter((other) => other.id !== flag.id);
		} catch {
			toast.error('Could not update that one. Reload and try again.');
		}
	}

	// svelte-ignore state_referenced_locally
	let lore = $state(initialLore);
	// svelte-ignore state_referenced_locally
	let opinions = $state(initialOpinions);
	let savingLore = $state(false);
	let search = $state('');
	// Writable derived: resets when navigating to another server.
	let selectedId = $derived(savedUsers[0]?.id ?? '');
	// "userId:kind" of notes deleted since the page loaded.
	let forgottenNotes = new SvelteSet<string>();

	const filteredUsers = $derived.by(() => {
		const query = search.trim().toLowerCase();
		return query
			? savedUsers.filter((user) => user.name.toLowerCase().includes(query))
			: savedUsers;
	});
	const selected = $derived(savedUsers.find((user) => user.id === selectedId) ?? savedUsers[0]);
	const visibleNotes = (user: SavedUser) =>
		user.notes.filter((note) => !forgottenNotes.has(`${user.id}:${note.kind}`));

	async function saveLore() {
		savingLore = true;
		try {
			await editLore({ guildId, lore });
			lore = lore.trim();
			toast.success('Saved the server lore');
		} catch {
			toast.error(`Could not save. Keep it under ${PERSONALITY_LIMITS.lore} characters.`);
		} finally {
			savingLore = false;
		}
	}

	async function forgetNote(userId: string, kind: string) {
		try {
			await forgetUserNote({ guildId, userId, kind });
			forgottenNotes.add(`${userId}:${kind}`);
		} catch {
			toast.error('Could not delete that note');
		}
	}

	async function deleteOpinion(topic: string) {
		try {
			await forgetOpinion({ guildId, topic });
			opinions = opinions.filter((entry) => entry.topic !== topic);
		} catch {
			toast.error('Could not delete that opinion');
		}
	}

	async function deleteAllOpinions() {
		if (!confirm('Delete every opinion jjb has picked up in this server?')) return;
		try {
			await forgetAllOpinions({ guildId });
			opinions = [];
		} catch {
			toast.error('Could not delete her opinions');
		}
	}
</script>

<div class="flex flex-col gap-4">
	<Card.Root>
		<Card.Header>
			<Card.Title>Weekly review</Card.Title>
			<Card.Description>
				{#if review}
					How chat went {day(review.periodStart)} to {day(review.periodEnd)}, and notes or opinions
					that make her sound robotic. Delete them, or keep them and they won’t be flagged again.
				{:else}
					No review yet. The weekly reviewer posts here once it has run.
				{/if}
			</Card.Description>
			{#if review}
				<Card.Action>
					<Button variant="outline" onclick={() => (showReport = !showReport)}>
						{showReport ? 'Hide full review' : 'Full review'}
					</Button>
				</Card.Action>
			{/if}
		</Card.Header>
		{#if review}
			<Card.Content class="flex flex-col gap-4">
				<p class="text-sm whitespace-pre-wrap">{showReport ? review.report : review.summary}</p>
				{#if flags.length}
					<div class="flex max-h-[28rem] flex-col gap-2 overflow-y-auto">
						{#each flags as flag (flag.id)}
							<div class="flex items-start justify-between gap-3 rounded-lg border p-2">
								<div class="min-w-0 flex-1 text-sm">
									<p>
										<span class="font-medium">
											{flag.target === 'note'
												? `Note on ${nameOf(flag.userId)}`
												: `Opinion on ${flag.key}`}
										</span>
										<span class="text-muted-foreground">· {flag.text}</span>
									</p>
									<p class="mt-1 text-xs text-muted-foreground">{flag.reason}</p>
								</div>
								<div class="flex shrink-0 gap-1">
									<Button
										variant="ghost"
										size="icon"
										aria-label={`Keep: ${flag.text}`}
										title="Keep"
										onclick={() => resolveFlag(flag, 'keep')}
									>
										<CheckIcon />
									</Button>
									<Button
										variant="ghost"
										size="icon"
										aria-label={`Delete: ${flag.text}`}
										title="Delete"
										onclick={() => resolveFlag(flag, 'delete')}
									>
										<Trash2Icon />
									</Button>
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<p class="text-sm text-muted-foreground">Nothing flagged right now.</p>
				{/if}
			</Card.Content>
		{/if}
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>Server lore</Card.Title>
			<Card.Description>
				What this server is about, inside jokes, who the regulars are. She already knows the server
				and channel names. Changes reach her within a minute.
			</Card.Description>
			<Card.Action>
				<Button onclick={saveLore} disabled={savingLore}>
					<SaveIcon />
					Save
				</Button>
			</Card.Action>
		</Card.Header>
		<Card.Content>
			<Field.Field>
				<textarea
					aria-label="Server lore"
					class="min-h-36 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
					maxlength={PERSONALITY_LIMITS.lore}
					placeholder="e.g. a friends' server that started as a league group. 'the fat club' is the server nickname. regulars: ..."
					bind:value={lore}
					disabled={savingLore}
				></textarea>
				<Field.Description>{lore.length}/{PERSONALITY_LIMITS.lore}</Field.Description>
			</Field.Field>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>Members</Card.Title>
			<Card.Description>What jjb remembers about people in this server.</Card.Description>
			{#if canResetLoot}
				<Card.Action>
					<form
						method="POST"
						action="?/resetLoot"
						onsubmit={(event) => {
							if (!confirm('Reset every player’s loot inventory to zero?')) event.preventDefault();
						}}
					>
						<Button type="submit" variant="destructive">Reset all loot</Button>
					</form>
				</Card.Action>
			{/if}
		</Card.Header>
		<Card.Content class="grid gap-5 md:grid-cols-[minmax(14rem,0.8fr)_2fr]">
			<div class="flex max-h-[30rem] flex-col gap-2 overflow-y-auto">
				{#if savedUsers.length === 0}
					<p class="text-sm text-muted-foreground">She hasn’t saved anything about anyone yet.</p>
				{:else}
					<Input
						type="search"
						placeholder="Search members"
						aria-label="Search members"
						bind:value={search}
						class="sticky top-0 z-10 bg-background"
					/>
					{#if filteredUsers.length === 0}
						<p class="text-sm text-muted-foreground">No members match “{search.trim()}”.</p>
					{/if}
					{#each filteredUsers as user (user.id)}
						<button
							class={`flex items-center gap-3 rounded-lg border p-2 text-left hover:bg-accent ${selected?.id === user.id ? 'bg-accent' : ''}`}
							onclick={() => (selectedId = user.id)}
						>
							{#if user.avatar}
								<img src={user.avatar} alt="" class="size-9 rounded-full" />
							{:else}
								<span class="flex size-9 items-center justify-center rounded-full bg-muted">
									<UsersIcon size={16} />
								</span>
							{/if}
							<span class="min-w-0 truncate font-medium">{user.name}</span>
						</button>
					{/each}
				{/if}
			</div>
			{#if selected}
				<div class="flex min-w-0 flex-col gap-3">
					<div>
						<h3 class="text-lg font-semibold">{selected.name}</h3>
						<p class="text-sm text-muted-foreground">
							Nickname: {selected.nickname ?? 'none saved'}
						</p>
					</div>
					<div class="rounded-lg border p-4">
						<h4 class="mb-2 font-medium">Notes</h4>
						{#if visibleNotes(selected).length === 0}
							<p class="text-sm text-muted-foreground">Nothing saved about them yet.</p>
						{:else}
							<div class="flex max-h-80 flex-col gap-2 overflow-y-auto">
								{#each visibleNotes(selected) as note (note.kind)}
									<div class="flex items-start justify-between gap-3 rounded-lg border p-2">
										<p class="min-w-0 text-sm">{note.value}</p>
										<Button
											variant="ghost"
											size="icon"
											aria-label={`Delete note: ${note.value}`}
											onclick={() => forgetNote(selected.id, note.kind)}
										>
											<XIcon />
										</Button>
									</div>
								{/each}
							</div>
						{/if}
					</div>
					<div class="grid gap-3 sm:grid-cols-2">
						<div class="rounded-lg border p-4">
							<h4 class="mb-2 font-medium">PoE 2 loot</h4>
							{#if selected.loot.length}
								<ul class="flex flex-col gap-1">
									{#each selected.loot as item (item.itemName)}
										<li class="flex justify-between gap-3 text-sm">
											<span>{item.itemName}</span>
											<span class="font-mono">× {item.quantity}</span>
										</li>
									{/each}
								</ul>
							{:else}
								<p class="text-sm text-muted-foreground">No loot saved.</p>
							{/if}
						</div>
						<div class="rounded-lg border p-4">
							<h4 class="mb-2 font-medium">Other saved data</h4>
							<p class="text-sm">Wordle games: {selected.wordleGames}</p>
							<p class="text-sm">Custom signups: {selected.customSignups}</p>
							{#if selected.pets.length}
								<p class="text-sm">Pets: {selected.pets.join(', ')}</p>
							{/if}
							{#if selected.leagueAccounts.length}
								<p class="text-sm">
									League accounts: {selected.leagueAccounts
										.map(
											(account) =>
												`${account.gameName ?? 'Unnamed'}#${account.tagline ?? '—'} (${account.region})`
										)
										.join(', ')}
								</p>
							{/if}
						</div>
					</div>
				</div>
			{/if}
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>Her opinions</Card.Title>
			<Card.Description>
				Things she has said she thinks, so she stays consistent. Delete one to let her make up her
				mind again.
			</Card.Description>
			{#if opinions.length}
				<Card.Action>
					<Button variant="outline" onclick={deleteAllOpinions}>Delete all</Button>
				</Card.Action>
			{/if}
		</Card.Header>
		<Card.Content class="flex max-h-80 flex-col gap-2 overflow-y-auto">
			{#if opinions.length === 0}
				<p class="text-sm text-muted-foreground">No opinions yet. Ask her what she thinks.</p>
			{:else}
				{#each opinions as entry (entry.topic)}
					<div class="flex items-start justify-between gap-3 rounded-lg border p-2">
						<p class="min-w-0 flex-1 text-sm">
							<span class="font-medium">{entry.topic}</span>
							<span class="text-muted-foreground">· {entry.opinion}</span>
						</p>
						<Button
							variant="ghost"
							size="icon"
							aria-label={`Delete opinion on ${entry.topic}`}
							onclick={() => deleteOpinion(entry.topic)}
						>
							<XIcon />
						</Button>
					</div>
				{/each}
			{/if}
		</Card.Content>
	</Card.Root>
</div>
