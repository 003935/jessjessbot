<script lang="ts">
	import { getGuildLeaderboard } from '$lib/wordle.remote';
	import Trophy from '@lucide/svelte/icons/trophy';
	import User from '@lucide/svelte/icons/user';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	let { serverId }: { serverId: string } = $props();

	const query = $derived(getGuildLeaderboard(serverId));

	type SortKey = keyof NonNullable<typeof query.current>;

	let sortBy: SortKey = $state('byWins');

	const data = $derived(query.current?.[sortBy] ?? []);

	const sortLabel: Record<SortKey, string> = {
		byWins: 'by wins',
		byWinRate: 'by win rate',
		byAvgScore: 'by avg score',
	};
</script>

<section
	class="animate-in fade-in slide-in-from-bottom-4 card border border-base-300/50 bg-base-100 shadow-lg delay-300 duration-500"
>
	<div class="card-body">
		<div class="mb-2 flex items-center justify-between">
			<div class="flex items-center gap-3">
				<div class="rounded-xl bg-linear-to-br from-info/20 to-secondary/20 p-2">
					<Trophy size={22} class="text-info" />
				</div>
				<div>
					<h2 class="card-title text-xl">Leaderboard</h2>
					<p class="text-xs text-base-content/50">Top 10 players {sortLabel[sortBy]}</p>
				</div>
			</div>
			<div class="join">
				<button
					class={['btn join-item btn-xs btn-neutral', sortBy === 'byWins' ? 'btn-primary' : '']}
					onclick={() => (sortBy = 'byWins')}
				>
					Wins
				</button>
				<button
					class={['btn join-item btn-xs btn-neutral', sortBy === 'byWinRate' ? 'btn-primary' : '']}
					onclick={() => (sortBy = 'byWinRate')}
				>
					Win Rate
				</button>
				<button
					class={['btn join-item btn-xs btn-neutral', sortBy === 'byAvgScore' ? 'btn-primary' : '']}
					onclick={() => (sortBy = 'byAvgScore')}
				>
					Avg Score
				</button>
			</div>
		</div>
		<div class="mb-3 h-px bg-linear-to-r from-info/20 to-transparent"></div>

		{#if query.error}
			<div class="alert rounded-xl alert-error">
				<Trophy size={20} />
				<span>Failed to load leaderboard</span>
			</div>
		{:else if query.loading || !query.current}
			<div class="max-h-64 overflow-y-auto">
				<div class="overflow-x-auto">
					<table class="table table-sm">
						<thead>
							<tr class="sticky top-0 bg-base-100 z-10">
								<th class="w-12">#</th>
								<th>Player</th>
								<th class="text-right">Wins</th>
								<th class="text-right">Win Rate</th>
								<th class="text-right">Avg Score</th>
							</tr>
						</thead>
						<tbody>
							<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
							{#each Array(5) as _, i (i)}
								<tr>
									<td><div class="h-4 w-6 animate-pulse rounded bg-base-300"></div></td>
									<td>
										<div class="flex items-center gap-2">
											<div class="h-8 w-8 animate-pulse rounded-full bg-base-300"></div>
											<div class="h-4 w-24 animate-pulse rounded bg-base-300"></div>
										</div>
									</td>
									<td class="text-right"><div class="ml-auto h-4 w-10 animate-pulse rounded bg-base-300"></div></td>
									<td class="text-right"><div class="ml-auto h-4 w-12 animate-pulse rounded bg-base-300"></div></td>
									<td class="text-right"><div class="ml-auto h-4 w-10 animate-pulse rounded bg-base-300"></div></td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{:else if data.length === 0}
			<div class="py-6 text-center text-base-content/60">
				<p class="text-sm">No leaderboard data available</p>
			</div>
		{:else}
			<div class="max-h-64 overflow-y-auto">
				<div class="overflow-x-auto">
					<table class="table table-sm">
						<thead>
							<tr class="sticky top-0 bg-base-100 z-10">
								<th class="w-12">#</th>
								<th>Player</th>
								<th class="text-right">Wins</th>
								<th class="text-right">Win Rate</th>
								<th class="text-right">Avg Score</th>
							</tr>
						</thead>
						<tbody>
							{#each data as entry, index (entry.discordId)}
								<tr
									class="group cursor-pointer transition-colors hover:bg-info/10"
									onclick={() => goto(resolve(`/user/${entry.discordId}?serverId=${serverId}`))}
								>
									<td class="font-mono font-bold text-base-content/50">{index + 1}</td>
									<td>
										<div class="flex items-center gap-2">
											{#if entry.avatarUrl}
												<div class="avatar">
													<div class="mask w-8 rounded-full">
														<img src={entry.avatarUrl} alt="" />
													</div>
												</div>
											{:else}
												<div
													class="flex h-8 w-8 items-center justify-center rounded-full bg-base-300"
												>
													<User size={16} class="text-base-content/40" />
												</div>
											{/if}
											<span class="font-semibold transition-all group-hover:underline group-hover:text-info">
												{entry.displayName}
											</span>
										</div>
									</td>
									<td class="text-right font-bold">{entry.wins}</td>
									<td class="text-right">{entry.winRate.toFixed(1)}%</td>
									<td class="text-right">
										{#if entry.avgScore !== null}
											{entry.avgScore.toFixed(1)}
										{:else}
											N/A
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}
	</div>
</section>
