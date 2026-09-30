<script module lang="ts">
	import * as v from 'valibot';

	const import_message_schema = v.object({
		isDone: v.boolean(),
		scanned: v.number(),
		imported: v.number(),
		channelsCompleted: v.number(),
		channelsSkipped: v.number(),
		totalChannels: v.number(),
	});

	export type HallImportMessage = v.InferOutput<typeof import_message_schema>;
</script>

<script lang="ts">
	import { source } from 'sveltekit-sse';
	import CheckCircle from '@lucide/svelte/icons/check-circle';
	import Download from '@lucide/svelte/icons/download';
	import Flame from '@lucide/svelte/icons/flame';
	import Hash from '@lucide/svelte/icons/hash';
	import Info from '@lucide/svelte/icons/info';
	import Save from '@lucide/svelte/icons/save';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Empty from '$lib/components/ui/empty/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import Button from '$lib/components/ui/button/button.svelte';

	type Channel = { id: string; name: string };
	type ImportData = {
		lastImport: Date;
		messagesScanned: number;
		messagesImported: number;
	} | null;

	let {
		serverId,
		channels,
		selectedChannelIds,
		hallImport = null,
	}: {
		serverId: string;
		channels: Channel[];
		selectedChannelIds: string[];
		hallImport?: ImportData;
	} = $props();

	let selected = $state<string[]>([]);
	let saved = $state<string[]>([]);
	let initialized = $state(false);
	let saving = $state(false);
	let importing = $state(false);
	let rechecking = $state(false);
	let hasImported = $state(Boolean(hallImport));
	let error = $state<string | null>(null);
	let progress = $state<HallImportMessage | null>(null);
	let connection: ReturnType<typeof source> | null = $state(null);
	let cleanup: (() => void) | null = $state(null);

	let hasChanges = $derived(
		selected.length !== saved.length || selected.some((id) => !saved.includes(id))
	);
	let lastImported = $derived(progress?.isDone ? progress.imported : hallImport?.messagesImported);

	$effect(() => {
		if (initialized) return;
		selected = [...selectedChannelIds];
		saved = [...selectedChannelIds];
		initialized = true;
	});

	function toggleChannel(channelId: string) {
		selected = selected.includes(channelId)
			? selected.filter((id) => id !== channelId)
			: [...selected, channelId];
	}

	async function saveChannels() {
		saving = true;
		error = null;
		try {
			const response = await fetch(`/server/${serverId}/hall-channels`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ channelIds: selected }),
			});
			if (!response.ok) throw new Error(await response.text());
			const result = (await response.json()) as { channelIds: string[] };
			selected = [...result.channelIds];
			saved = [...result.channelIds];
			return true;
		} catch (caught) {
			error = caught instanceof Error ? caught.message : 'Could not save channels';
			return false;
		} finally {
			saving = false;
		}
	}

	function clearConnection() {
		cleanup?.();
		cleanup = null;
		connection = null;
	}

	async function startImport(recheckSaved = false) {
		if (importing) return;
		if (hasChanges && !(await saveChannels())) return;
		clearConnection();
		error = null;
		progress = null;
		importing = true;
		rechecking = recheckSaved;
		connection = source(`/server/${serverId}/hall-import${recheckSaved ? '?recheck=1' : ''}`);
		const unsubscribers: Array<() => void> = [];
		unsubscribers.push(
			connection.select('message').subscribe((value) => {
				if (!value) return;
				try {
					progress = v.parse(import_message_schema, JSON.parse(value));
					if (progress.isDone) {
						hasImported = true;
						importing = false;
					}
				} catch {
					error = 'The import returned an unexpected response';
					importing = false;
				}
			})
		);
		unsubscribers.push(
			connection.select('error').subscribe((value) => {
				if (!value) return;
				error = value;
				importing = false;
			})
		);
		cleanup = () => unsubscribers.forEach((unsubscribe) => unsubscribe());
	}

	$effect(() => () => clearConnection());
</script>

<Card.Root class="overflow-hidden">
	<Card.Header class="border-b border-border/70">
		<div class="flex items-center gap-3">
			<div class="flex size-10 items-center justify-center rounded-xl bg-primary/12 text-primary">
				<Flame size={20} />
			</div>
			<div>
				<Card.Title>Hall of Fame Import</Card.Title>
				<Card.Description>
					{#if lastImported !== undefined}
						Last update: {lastImported.toLocaleString()} qualifying messages imported
					{:else}
						Build a server-wide database of reacted messages
					{/if}
				</Card.Description>
			</div>
		</div>
		<Card.Action>
			<Tooltip.Provider>
				<Tooltip.Root>
					<Tooltip.Trigger aria-label="About Hall of Fame imports">
						<Info class="text-muted-foreground" />
					</Tooltip.Trigger>
					<Tooltip.Content class="max-w-72">
						Scans readable text channels across the server. Later updates check new messages. The
						channel checkboxes only control what appears in the leaderboard.
					</Tooltip.Content>
				</Tooltip.Root>
			</Tooltip.Provider>
		</Card.Action>
	</Card.Header>

	<Card.Content class="flex min-h-96 flex-col gap-5 pt-5">
		<div class="flex items-center justify-between gap-3">
			<div>
				<p class="text-sm font-semibold">Leaderboard channels</p>
				<p class="text-xs text-muted-foreground">{selected.length} of {channels.length} selected</p>
			</div>
			<Button
				variant="outline"
				size="sm"
				onclick={saveChannels}
				disabled={!hasChanges || saving || importing}
			>
				<Save />
				{saving ? 'Saving…' : 'Save channels'}
			</Button>
		</div>

		<div class="grid max-h-52 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
			{#each channels as channel (channel.id)}
				<label
					class="group flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors hover:bg-accent has-[:checked]:border-primary/50 has-[:checked]:bg-primary/8"
				>
					<input
						type="checkbox"
						class="size-4 accent-primary"
						checked={selected.includes(channel.id)}
						onchange={() => toggleChannel(channel.id)}
					/>
					<Hash
						size={15}
						class="shrink-0 text-muted-foreground group-has-[:checked]:text-primary"
					/>
					<span class="truncate text-sm font-medium">{channel.name}</span>
				</label>
			{/each}
		</div>

		{#if error}
			<div
				class="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
			>
				{error}
			</div>
		{:else if importing}
			<div class="rounded-xl bg-muted/60 p-4">
				<div class="mb-3 flex items-center justify-between text-sm">
					<span class="font-medium">
						{rechecking ? 'Rechecking saved messages…' : 'Scanning server messages…'}
					</span>
					{#if progress}
						<span class="font-mono font-semibold text-primary">
							{#if rechecking}
								{progress.scanned.toLocaleString()} messages checked
							{:else}
								{progress.channelsCompleted} of {progress.totalChannels} channels finished
							{/if}
						</span>
					{/if}
				</div>
				{#if progress}
					<p class="text-xs text-muted-foreground">
						{progress.scanned.toLocaleString()} checked · {progress.imported.toLocaleString()}
						{rechecking ? 'scores updated' : 'with 3+ reactions'}
						{#if progress.channelsSkipped > 0}
							· {progress.channelsSkipped} inaccessible channel{progress.channelsSkipped === 1
								? ''
								: 's'} skipped
						{/if}
					</p>
				{/if}
			</div>
		{:else if progress?.isDone}
			<Empty.Root class="min-h-28 rounded-xl bg-primary/6">
				<Empty.Header>
					<CheckCircle class="text-primary" />
					<Empty.Title>Hall of Fame updated</Empty.Title>
					<Empty.Description>
						{#if rechecking}
							Rechecked {progress.scanned.toLocaleString()} saved messages and updated
							{progress.imported.toLocaleString()} scores.
						{:else}
							Checked {progress.scanned.toLocaleString()} new messages and imported
							{progress.imported.toLocaleString()} with 3+ reactions.
						{/if}
						{#if progress.channelsSkipped > 0}
							{progress.channelsSkipped} inaccessible channel{progress.channelsSkipped === 1
								? ' was'
								: 's were'} skipped.
						{/if}
					</Empty.Description>
				</Empty.Header>
			</Empty.Root>
		{/if}

		{#if hasImported}
			<Button
				variant="outline"
				class="w-full"
				onclick={() => startImport(true)}
				disabled={importing || saving}
			>
				<Download />
				Recheck saved messages for reaction scores
			</Button>
		{/if}

		<Button
			class="mt-auto h-14 w-full"
			onclick={() => startImport()}
			disabled={importing || saving}
		>
			<Download />
			{importing ? 'Updating…' : hasImported ? 'Update database' : 'Import reacted messages'}
		</Button>
	</Card.Content>
</Card.Root>
