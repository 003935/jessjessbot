<script module>
	import * as v from 'valibot';

	const message_schema = v.object({
		isDone: v.boolean(),
		processed: v.number(),
		total: v.number(),
		unresolved_failed_mentions: v.optional(v.array(v.string())),
	});

	export type WordleImportMessage = v.InferOutput<typeof message_schema>;
</script>

<script lang="ts">
	import { source } from 'sveltekit-sse';
	import { browser } from '$app/environment';
	import Gamepad2 from '@lucide/svelte/icons/gamepad-2';
	import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
	import CheckCircle from '@lucide/svelte/icons/check-circle';
	import Clock from '@lucide/svelte/icons/clock';

	type Progress = {
		isDone: boolean;
		processed: number;
		total: number;
		unresolved_failed_mentions?: string[];
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
	};

	let { serverId, wordleImport = null }: { serverId: string; wordleImport?: WordleImportData } =
		$props();

	let connection: ReturnType<typeof source> | null = null;
	let cleanup: (() => void) | null = null;
	let countdown_interval: ReturnType<typeof setInterval> | null = null;

	let progress = $state<Progress | null>(null);
	let error = $state<string | null>(null);
	let is_importing = $state(false);
	let last_import_time = $state<number | null>(null);
	let percentage = $derived(progress ? Math.round((progress.processed / progress.total) * 100) : 0);

	// Initialize last_import_time from prop
	$effect(() => {
		if (wordleImport?.lastImport && browser) {
			last_import_time = new Date(wordleImport.lastImport).getTime();
		} else {
			last_import_time = null;
		}
	});

	// Calculate rate limit derived value
	let rate_limit: RateLimitInfo | null = $derived.by(() => {
		if (last_import_time === null || !browser) return null;

		const now = Date.now();
		const elapsed = now - last_import_time;
		const cooldownMs = 24 * 60 * 60 * 1000;

		if (elapsed >= cooldownMs) {
			return null;
		}

		const remainingMs = cooldownMs - elapsed;
		const hoursRemaining = Math.floor(remainingMs / (1000 * 60 * 60));
		const minutesRemaining = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));

		return {
			isLimited: true,
			hoursRemaining,
			minutesRemaining,
		};
	});

	function cleanup_connection() {
		if (cleanup) {
			cleanup();
			cleanup = null;
		}
		if (countdown_interval) {
			clearInterval(countdown_interval);
			countdown_interval = null;
		}
		connection = null;
	}

	function start_import() {
		if (is_importing || !browser || rate_limit?.isLimited) return;

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
						if (parsed.unresolved_failed_mentions) {
							console.warn('Unresolved failed mentions:', parsed.unresolved_failed_mentions);
						}
						progress = {
							isDone: parsed.isDone,
							processed: parsed.processed,
							total: parsed.total,
							unresolved_failed_mentions: parsed.unresolved_failed_mentions,
						};
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

			cleanup = () => {
				subscriptions.forEach((unsubscribe) => unsubscribe());
			};
		} catch (e) {
			console.error('Failed to setup SSE connection:', e);
			error = 'Failed to establish connection to server';
			is_importing = false;
			cleanup_connection();
		}
	}

	// Update countdown every minute when rate limited or done
	$effect(() => {
		if ((rate_limit?.isLimited || progress?.isDone) && browser) {
			countdown_interval = setInterval(() => {
				if (last_import_time !== null) {
					last_import_time = last_import_time;
				}
			}, 60000);

			return () => {
				if (countdown_interval) {
					clearInterval(countdown_interval);
					countdown_interval = null;
				}
			};
		}
	});

	// Cleanup on unmount
	$effect(() => {
		return () => {
			cleanup_connection();
		};
	});
</script>

<div class="card border border-base-300 bg-base-100 shadow-xl">
	<div class="card-body pt-6">
		<div class="mb-4 flex items-center justify-between">
			<div class="flex items-center gap-3">
				<div class="rounded-xl bg-gradient-to-br from-secondary/20 to-primary/20 p-2">
					<Gamepad2 size={24} class="text-secondary" />
				</div>
				<h2 class="card-title text-2xl">Wordle Message Import</h2>
			</div>
		</div>
		<div class="mb-4 h-px bg-gradient-to-r from-secondary/20 to-transparent"></div>

		<div class="flex flex-col gap-4">
			<p class="text-sm text-base-content/60">
				Import historical Wordle messages from your server. This fetches all messages containing
				yesterday's Wordle results and processes them for analytics.
			</p>

			{#if error}
				<div class="alert rounded-xl alert-error" role="alert">
					<AlertTriangle size={20} />
					<span>{error}</span>
				</div>
			{:else if progress?.isDone && progress}
				<div class="alert rounded-xl alert-success" role="alert">
					<CheckCircle size={20} />
					<span>
						Successfully imported {progress.processed} messages! You can import again in 24 hours.
					</span>
				</div>
				{#if progress.unresolved_failed_mentions && progress.unresolved_failed_mentions.length > 0}
					<div class="alert rounded-xl alert-warning" role="alert">
						<AlertTriangle size={20} />
						<span>Could not resolve some mentions. Check the console for more information.</span>
					</div>
				{/if}
			{:else if is_importing}
				<div class="flex flex-col gap-3" aria-live="polite" aria-busy="true">
					<div class="flex items-center justify-between">
						<span class="text-sm">Importing messages...</span>
						<span class="font-mono text-sm">{percentage}%</span>
					</div>
					<progress
						class="progress w-full progress-secondary"
						value={percentage}
						max="100"
					></progress>
					{#if progress}
						<div class="flex items-center gap-4 text-xs text-base-content/60">
							<span>{progress.processed}/{progress.total} messages</span>
						</div>
					{/if}
				</div>
			{:else if rate_limit?.isLimited}
				<div class="flex flex-col gap-3">
					<button
						class="btn btn-disabled cursor-not-allowed gap-2 opacity-50 btn-secondary"
						disabled={true}
						type="button"
					>
						<Clock size={18} />
						Import on Cooldown
					</button>
					<div class="alert-warning/10 alert rounded-xl border border-warning/20" role="status">
						<Clock size={18} class="text-warning" />
						<div class="text-sm">
							<strong>Available in:</strong>
							{rate_limit.hoursRemaining}h{' '}
							{rate_limit.minutesRemaining}m
						</div>
					</div>
				</div>
			{:else}
				<button
					class="btn gap-2 btn-secondary"
					onclick={start_import}
					disabled={is_importing || !browser}
					type="button"
				>
					<Gamepad2 size={18} />
					Start Import
				</button>
			{/if}

			{#if !is_importing && !progress?.isDone && !error && !rate_limit?.isLimited}
				<div class="alert-info/10 alert rounded-xl border border-info/20" role="note">
					<Clock size={18} class="text-info" />
					<div class="text-xs text-base-content/60">
						<strong>Rate Limit:</strong>
						One import per 24 hours per server. This prevents API overuse and ensures fair usage across
						all servers.
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>
