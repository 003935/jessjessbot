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
	import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
	import CheckCircle from '@lucide/svelte/icons/check-circle';
	import Clock from '@lucide/svelte/icons/clock';
	import ImportIcon from '@lucide/svelte/icons/download';
	import Info from '@lucide/svelte/icons/info';
	import { getFailedMentions } from '$lib/failedMentions.remote';
	import { getGuildLeaderboard, getGuildSummary, getWordleStats } from '$lib/wordle.remote';

	type Progress = {
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

	let progress = $state<Progress | null>(null);
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

<div
	class="animate-in fade-in slide-in-from-bottom-4 card border border-base-300/50 bg-base-100 shadow-lg delay-200 duration-500"
>
	<div class="card-body pb-5">
		<div class="mb-2 flex items-center justify-between">
			<div class="flex items-center gap-3">
				<div class="rounded-xl bg-linear-to-br from-secondary/20 to-primary/20 p-2">
					<ImportIcon size={22} class="text-secondary" />
				</div>
				<div>
					<h2 class="card-title text-xl">Wordle Import</h2>
					<p class="text-xs text-base-content/50">
						{#if wordleImport}
							Last: {format_last_import()}
						{:else}
							No imports yet
						{/if}
					</p>
				</div>
			</div>
		</div>
		<div class="mb-3 h-px bg-linear-to-r from-secondary/20 to-transparent"></div>

		<div class="flex flex-col gap-4">
			<p class="text-sm text-base-content/60">
				Import historical Wordle messages from your server. This fetches messages containing
				yesterday's Wordle results and processes them for analytics.
			</p>

			{#if error}
				<div class="alert rounded-xl alert-error" role="alert">
					<AlertTriangle size={20} />
					<div class="flex flex-col">
						<span class="font-semibold">Import failed</span>
						<span class="text-sm">{error}</span>
					</div>
				</div>
			{:else if progress?.isDone && progress}
				<div
					class={[
						'alert rounded-xl',
						(progress?.failed ?? 0) > 0 ? 'alert-warning' : 'alert-success',
					]}
					role="status"
				>
					<CheckCircle size={20} />
					<div class="flex flex-col">
						<span class="font-semibold">Import complete!</span>
						<span class="text-sm">
							Successfully processed {progress.processed.toLocaleString()} messages.
							{progress.succeeded ?? 0} succeeded, {progress.failed ?? 0} failed, {progress.skipped ??
								0} skipped.
						</span>
					</div>
				</div>
				{#if progress.total_failed_mentions && progress.total_failed_mentions > 0}
					<div class="alert rounded-xl alert-warning" role="alert">
						<AlertTriangle size={20} />
						<span>
							Could not resolve {progress.total_failed_mentions} failed mention{progress.total_failed_mentions !==
							1
								? 's'
								: ''}.
						</span>
					</div>
				{/if}
			{:else if is_importing}
				<div class="flex flex-col gap-3" aria-live="polite" aria-busy="true">
					<div class="flex items-center justify-between">
						<span class="text-sm font-medium">Importing messages...</span>
						<span class="font-mono text-sm font-bold text-secondary">{percentage}%</span>
					</div>
					<progress
						class="progress w-full progress-secondary"
						value={percentage}
						max="100"
					></progress>
					{#if progress}
						<div class="flex items-center gap-2 text-xs text-base-content/60">
							<span class="loading loading-xs loading-dots"></span>
							<span>
								{progress.processed.toLocaleString()} / {progress.total.toLocaleString()} messages
							</span>
						</div>
					{/if}
				</div>
			{:else if rate_limit?.isLimited}
				<div class="flex flex-col gap-3">
					<button class="btn btn-disabled gap-2 opacity-60" disabled={true} type="button">
						<Clock size={18} />
						On Cooldown
					</button>
					<div class="alert rounded-xl border-warning/20 alert-warning" role="status">
						<Clock size={18} />
						<div class="text-sm">
							<strong>Available in:</strong>
							{rate_limit.hoursRemaining}h {rate_limit.minutesRemaining}m {rate_limit.secondsRemaining}s
						</div>
					</div>
				</div>
			{:else}
				<button
					class="btn gap-2 shadow-md transition-all btn-secondary hover:shadow-lg"
					onclick={start_import}
					disabled={is_importing}
					type="button"
				>
					<ImportIcon size={18} />
					Start Import
				</button>
				<div class="alert rounded-xl border-info/20 alert-info" role="note">
					<Info size={18} />
					<div class="text-xs">
						<strong>Rate limit:</strong>
						One import per 24 hours per server.
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>
