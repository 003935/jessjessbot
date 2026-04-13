<script lang="ts">
	import { getGuildSummary } from '$lib/wordle.remote';
	import Users from '@lucide/svelte/icons/users';
	import Gamepad2 from '@lucide/svelte/icons/gamepad-2';
	import Trophy from '@lucide/svelte/icons/trophy';
	import Target from '@lucide/svelte/icons/target';

	let { serverId }: { serverId: string } = $props();

	type GuildSummary = {
		totalPlayers: number;
		totalGames: number;
		totalWins: number;
		avgScore: number | null;
		avgWinningScore: number | null;
	};

	const query = $derived(getGuildSummary(serverId));
</script>

{#if query.loading}
	<div class="grid grid-cols-2 gap-4 md:grid-cols-5">
		<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
		{#each Array(5) as _, i (i)}
			<div class="flex animate-pulse items-center gap-3 rounded-xl bg-base-200/50 p-4">
				<div class="h-8 w-8 rounded-lg bg-base-300"></div>
				<div class="h-4 w-16 rounded bg-base-300"></div>
			</div>
		{/each}
	</div>
{:else if query.current}
	{@const summary = query.current}
	<div class="grid grid-cols-2 gap-4 md:grid-cols-5">
		<div class="rounded-xl bg-base-200/40 p-4">
			<div class="flex items-center gap-2">
				<div class="rounded-lg bg-primary/10 p-1.5">
					<Users size={18} class="text-primary" />
				</div>
				<span class="text-xs text-base-content/60">Players</span>
			</div>
			<p class="mt-2 text-2xl font-bold">{summary.totalPlayers}</p>
		</div>

		<div class="rounded-xl bg-base-200/40 p-4">
			<div class="flex items-center gap-2">
				<div class="rounded-lg bg-secondary/10 p-1.5">
					<Gamepad2 size={18} class="text-secondary" />
				</div>
				<span class="text-xs text-base-content/60">Games</span>
			</div>
			<p class="mt-2 text-2xl font-bold">{summary.totalGames}</p>
		</div>

		<div class="rounded-xl bg-base-200/40 p-4">
			<div class="flex items-center gap-2">
				<div class="rounded-lg bg-accent/10 p-1.5">
					<Trophy size={18} class="text-accent" />
				</div>
				<span class="text-xs text-base-content/60">Wins</span>
			</div>
			<p class="mt-2 text-2xl font-bold">{summary.totalWins}</p>
		</div>

		<div class="rounded-xl bg-base-200/40 p-4">
			<div class="flex items-center gap-2">
				<div class="rounded-lg bg-warning/10 p-1.5">
					<Target size={18} class="text-warning" />
				</div>
				<span class="text-xs text-base-content/60">Avg Score</span>
			</div>
			<p class="mt-2 text-2xl font-bold">
				{#if summary.avgScore !== null}
					{summary.avgScore.toFixed(1)}
				{:else}
					N/A
				{/if}
			</p>
		</div>

		<div class="rounded-xl bg-base-200/40 p-4">
			<div class="flex items-center gap-2">
				<div class="rounded-lg bg-success/10 p-1.5">
					<Trophy size={18} class="text-success" />
				</div>
				<span class="text-xs text-base-content/60">Avg Win</span>
			</div>
			<p class="mt-2 text-2xl font-bold">
				{#if summary.avgWinningScore !== null}
					{summary.avgWinningScore.toFixed(1)}
				{:else}
					N/A
				{/if}
			</p>
		</div>
	</div>
{/if}
