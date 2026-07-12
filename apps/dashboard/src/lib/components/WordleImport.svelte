<script module lang="ts">
	import * as v from 'valibot';

	const message_schema = v.object({
		isDone: v.boolean(),
		processed: v.number(),
		total: v.number(),
		total_failed_mentions: v.optional(v.number()),
		succeeded: v.optional(v.number()),
		failed: v.optional(v.number()),
		skipped: v.optional(v.number()),
	});

	export type WordleImportMessage = v.InferOutput<typeof message_schema>;
</script>

<script lang="ts">
	import { source } from 'sveltekit-sse';
	import CheckCircle from '@lucide/svelte/icons/check-circle';
	import Clock from '@lucide/svelte/icons/clock';
	import ImportIcon from '@lucide/svelte/icons/download';
	import { getFailedMentions } from '$lib/failedMentions.remote';
	import { getGuildLeaderboard, getGuildSummary, getWordleStats } from '$lib/wordle.remote';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Empty from '$lib/components/ui/empty/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { CircleAlertIcon, InfoIcon } from '@lucide/svelte';
	import Button from './ui/button/button.svelte';
	import Progress from './ui/progress/progress.svelte';
	import * as Alert from './ui/alert';

	type ProgressState = {
		isDone: boolean;
		processed: number;
		total: number;
		total_failed_mentions?: number;
		succeeded?: number;
		failed?: number;
		skipped?: number;
	};

	type WordleImportData = {
		lastImport: Date;
		importedBy: string;
		messagesImported: number;
	} | null;

	type RateLimitInfo = {
		isLimited: boolean;
		hoursRemaining: number;
		minutesRemaining: number;
		secondsRemaining: number;
	};

	let { serverId, wordleImport = null }: { serverId: string; wordleImport?: WordleImportData } =
		$props();

	let connection: ReturnType<typeof source> | null = $state(null);
	let cleanup_fn: (() => void) | null = $state(null);

	let progress = $state<ProgressState | null>(null);
	let error = $state<string | null>(null);
	let is_importing = $state(false);
	let last_import_time = $derived(wordleImport?.lastImport?.getTime() ?? null);
	let date_now = $state(new Date().getTime());

	let percentage = $derived(progress ? Math.round((progress.processed / progress.total) * 100) : 0);

	let rate_limit: RateLimitInfo | null = $derived.by(() => {
		if (last_import_time === null) return null;

		const elapsed = date_now - last_import_time;
		const cooldown_ms = 24 * 60 * 60 * 1000;

		if (elapsed >= cooldown_ms) {
			return null;
		}

		const remaining_ms = cooldown_ms - elapsed;
		const hoursRemaining = Math.floor(remaining_ms / (1000 * 60 * 60));
		const minutesRemaining = Math.floor((remaining_ms % (1000 * 60 * 60)) / (1000 * 60));
		const secondsRemaining = Math.floor((remaining_ms % (1000 * 60)) / 1000);

		return {
			isLimited: true,
			hoursRemaining,
			minutesRemaining,
			secondsRemaining,
		};
	});

	function cleanup_connection() {
		if (cleanup_fn) {
			cleanup_fn();
			cleanup_fn = null;
		}
		connection = null;
	}

	function start_import() {
		if (is_importing || rate_limit?.isLimited) return;

		cleanup_connection();

		is_importing = true;
		error = null;
		progress = null;

		connection = source(`/server/${serverId}/wordle-import`);

		const subscriptions: Array<() => void> = [];

		try {
			subscriptions.push(
				connection.select('message').subscribe((value) => {
					if (!value) return;
					try {
						const parsed = v.parse(message_schema, JSON.parse(value));
						if (parsed.total_failed_mentions) {
							console.warn('Unresolved failed mentions:', parsed.total_failed_mentions);
						}
						progress = parsed;

						if (parsed.isDone) {
							is_importing = false;
							last_import_time = Date.now();
							getFailedMentions(serverId).refresh();
							getWordleStats(serverId).refresh();
							getGuildLeaderboard(serverId).refresh();
							getGuildSummary(serverId).refresh();
						}
					} catch (e) {
						console.error('Failed to parse message:', e);
					}
				})
			);

			subscriptions.push(
				connection.select('error').subscribe((value) => {
					if (!value) return;
					error = value;
					is_importing = false;
				})
			);

			cleanup_fn = () => {
				subscriptions.forEach((unsubscribe) => unsubscribe());
			};
		} catch (e) {
			console.error('Failed to setup SSE connection:', e);
			error = 'Failed to establish connection to server';
			is_importing = false;
			cleanup_connection();
		}
	}

	$effect(() => {
		if (is_importing || rate_limit?.isLimited) {
			const interval = setInterval(() => {
				date_now = new Date().getTime();
			}, 1000);

			return () => clearInterval(interval);
		}
	});

	$effect(() => {
		return () => {
			cleanup_connection();
		};
	});

	function format_last_import() {
		if (!wordleImport) return null;
		const count = wordleImport.messagesImported;
		return `${count.toLocaleString()} message${count !== 1 ? 's' : ''} imported`;
	}
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>Wordle Import</Card.Title>
		<Card.Description>
			{#if wordleImport}
				Last: {format_last_import()}
			{:else}
				No imports yet
			{/if}
		</Card.Description>
		<Card.Action>
			<Tooltip.Provider>
				<Tooltip.Root>
					<Tooltip.Trigger>
						<InfoIcon class="text-muted-foreground" />
					</Tooltip.Trigger>
					<Tooltip.Content>
						<p>
							Import historical Wordle messages from your server. This fetches messages containing
							yesterday's Wordle results and processes them for analytics.
						</p>
					</Tooltip.Content>
				</Tooltip.Root>
			</Tooltip.Provider>
		</Card.Action>
	</Card.Header>
	<Card.Content class="flex h-64 flex-col justify-center">
		{#if error}
			<Empty.Root>
				<Empty.Header>
					<Empty.Title>Error</Empty.Title>
					<Empty.Description>Import failed</Empty.Description>
				</Empty.Header>
			</Empty.Root>
		{:else if progress?.isDone && progress}
			<Empty.Root>
				<Empty.Header>
					<CheckCircle />
					<Empty.Title>Import complete!</Empty.Title>
					<Empty.Description>
						<p>Processed {progress.processed.toLocaleString()} messages.</p>
						<p>
							{progress.succeeded ?? 0} succeeded, {progress.failed ?? 0} failed, {progress.skipped ??
								0} skipped.
						</p>
					</Empty.Description>
				</Empty.Header>
				{#if progress.total_failed_mentions && progress.total_failed_mentions > 0}
					<Alert.Root variant="destructive">
						<CircleAlertIcon />
						<Alert.Title>Failed to parse mentions</Alert.Title>
						<Alert.Description>
							<p>
								Could not resolve {progress.total_failed_mentions} failed mention{progress.total_failed_mentions !==
								1
									? 's'
									: ''}.
							</p>
						</Alert.Description>
					</Alert.Root>
				{/if}
			</Empty.Root>
		{:else if is_importing}
			<div class="flex flex-col gap-3">
				<div class="flex items-center justify-between">
					<span class="text-sm font-medium">Importing messages...</span>
					<span class="font-mono text-sm font-bold text-primary">{percentage}%</span>
				</div>
				<Progress value={percentage} max={100}></Progress>
				{#if progress}
					<div class="flex items-center gap-2 text-xs">
						<span class="loading loading-xs loading-dots"></span>
						<span>
							{progress.processed.toLocaleString()} / {progress.total.toLocaleString()} messages
						</span>
					</div>
				{/if}
			</div>
		{:else if rate_limit?.isLimited}
			<Empty.Root>
				<Empty.Header>
					<Clock />
					<Empty.Title>On Cooldown</Empty.Title>
					<Empty.Description>
						Available in: {rate_limit.hoursRemaining}h {rate_limit.minutesRemaining}m
					</Empty.Description>
				</Empty.Header>
			</Empty.Root>
		{:else}
			<Button class="h-14 w-full self-center" onclick={start_import} disabled={is_importing}>
				<ImportIcon />
				Start Import
			</Button>
		{/if}
	</Card.Content>
</Card.Root>
