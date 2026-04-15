<script lang="ts">
	import type { PageProps } from './$types';
	import User from '@lucide/svelte/icons/user';
	import Trophy from '@lucide/svelte/icons/trophy';
	import Percent from '@lucide/svelte/icons/percent';
	import Target from '@lucide/svelte/icons/target';
	import Flame from '@lucide/svelte/icons/flame';
	import TrendingUp from '@lucide/svelte/icons/trending-up';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import WordleScoreDist from '$lib/components/WordleScoreDist.svelte';

	let { data }: PageProps = $props();
</script>

<div class="min-h-screen bg-linear-to-br from-base-300/20 via-base-200/30 to-base-100">
	<div class="container mx-auto max-w-7xl px-4 py-8">
		<div class="animate-in fade-in slide-in-from-top-4 mb-6 duration-300">
			{#if data.serverId}
				<button
					class="btn gap-2 rounded-lg text-base-content/70 btn-ghost btn-sm hover:text-base-content"
					onclick={() => goto(resolve(`/server/${data.serverId}`))}
				>
					<ArrowLeft size={16} />
					Back to server
				</button>
			{:else}
				<button
					class="btn gap-2 rounded-lg text-base-content/70 btn-ghost btn-sm hover:text-base-content"
					onclick={() => goto(resolve('/'))}
				>
					<ArrowLeft size={16} />
					Back to home
				</button>
			{/if}
		</div>

		<section
			class="animate-in fade-in slide-in-from-bottom-4 card mb-8 border border-base-300/50 bg-base-100 shadow-lg duration-500"
		>
			<div class="card-body">
				<div class="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
					<div class="avatar shrink-0">
						<div class="mask w-20 rounded-2xl mask-squircle shadow-lg ring-2 ring-primary/30">
							{#if data.avatarUrl}
								<img src={data.avatarUrl} alt="" />
							{:else}
								<div class="flex h-20 w-20 items-center justify-center bg-base-300">
									<User size={32} class="text-base-content/40" />
								</div>
							{/if}
						</div>
					</div>
					<div class="flex-1">
						<h1
							class="bg-linear-to-r from-primary to-secondary bg-clip-text text-3xl font-bold text-transparent"
						>
							{data.displayName}
						</h1>
					</div>
				</div>
			</div>
		</section>

		<section class="mb-8">
			<h2 class="mb-4 text-2xl font-bold">Wordle Statistics</h2>

			<div class="mb-6 grid grid-cols-2 gap-4 md:grid-cols-5">
				<div
					class="animate-in fade-in slide-in-from-bottom-4 card border border-base-300/50 bg-base-100 shadow-lg delay-100 duration-500"
				>
					<div class="card-body p-4">
						<div class="flex items-center gap-2">
							<div class="rounded-lg bg-primary/10 p-1.5">
								<Trophy size={18} class="text-primary" />
							</div>
							<span class="text-xs text-base-content/60">Wins / Played</span>
						</div>
						<p class="mt-2 text-2xl font-bold">
							{data.stats.totalWins}
							<span class="text-sm font-normal text-base-content/50">
								/ {data.stats.totalGames}
							</span>
						</p>
					</div>
				</div>

				<div
					class="animate-in fade-in slide-in-from-bottom-4 card border border-base-300/50 bg-base-100 shadow-lg delay-150 duration-500"
				>
					<div class="card-body p-4">
						<div class="flex items-center gap-2">
							<div class="rounded-lg bg-accent/10 p-1.5">
								<Percent size={18} class="text-accent" />
							</div>
							<span class="text-xs text-base-content/60">Win Rate</span>
						</div>
						<p class="mt-2 text-2xl font-bold">{data.stats.winRate.toFixed(1)}%</p>
					</div>
				</div>

				<div
					class="animate-in fade-in slide-in-from-bottom-4 card border border-base-300/50 bg-base-100 shadow-lg delay-200 duration-500"
				>
					<div class="card-body p-4">
						<div class="flex items-center gap-2">
							<div class="rounded-lg bg-warning/10 p-1.5">
								<Target size={18} class="text-warning" />
							</div>
							<span class="text-xs text-base-content/60">Avg Score</span>
						</div>
						<p class="mt-2 text-2xl font-bold">
							{#if data.stats.averageScore !== null}
								{data.stats.averageScore.toFixed(1)}
							{:else}
								N/A
							{/if}
						</p>
					</div>
				</div>

				<div
					class="animate-in fade-in slide-in-from-bottom-4 card border border-base-300/50 bg-base-100 shadow-lg delay-250 duration-500"
				>
					<div class="card-body p-4">
						<div class="flex items-center gap-2">
							<div class="rounded-lg bg-error/10 p-1.5">
								<Flame size={18} class="text-error" />
							</div>
							<span class="text-xs text-base-content/60">Best Streak</span>
						</div>
						<p class="mt-2 text-2xl font-bold">{data.stats.bestStreak}</p>
					</div>
				</div>

				<div
					class="animate-in fade-in slide-in-from-bottom-4 card border border-base-300/50 bg-base-100 shadow-lg delay-300 duration-500"
				>
					<div class="card-body p-4">
						<div class="flex items-center gap-2">
							<div class="rounded-lg bg-info/10 p-1.5">
								<Flame size={18} class="text-info" />
							</div>
							<span class="text-xs text-base-content/60">Current Streak</span>
						</div>
						<p class="mt-2 text-2xl font-bold">{data.stats.currentStreak}</p>
					</div>
				</div>
			</div>

			<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
				<section
					class="animate-in fade-in slide-in-from-bottom-4 card border border-base-300/50 bg-base-100 shadow-lg delay-400 duration-500"
				>
					<div class="card-body">
						<div class="mb-2 flex items-center gap-3">
							<div class="rounded-xl bg-linear-to-br from-info/20 to-secondary/20 p-2">
								<TrendingUp size={22} class="text-info" />
							</div>
							<div>
								<h2 class="card-title text-xl">Score Distribution</h2>
								<p class="text-xs text-base-content/50">All games played</p>
							</div>
						</div>
						<div class="mb-3 h-px bg-linear-to-r from-info/20 to-transparent"></div>

						{#if data.stats}
							<div class="h-64">
								<WordleScoreDist
									data={data.stats.scoreDistribution.map((d) => ({
										score: d.score,
										value: d.count,
									}))}
								/>
							</div>
						{:else}
							<div class="py-10 text-center text-base-content/60">
								<p class="text-base font-medium">No data available</p>
							</div>
						{/if}
					</div>
				</section>

				<section
					class="animate-in fade-in slide-in-from-bottom-4 card border border-base-300/50 bg-base-100 shadow-lg delay-500 duration-500"
				>
					<div class="card-body">
						<div class="mb-2 flex items-center gap-3">
							<div class="rounded-xl bg-linear-to-br from-success/20 to-secondary/20 p-2">
								<TrendingUp size={22} class="text-success" />
							</div>
							<div>
								<h2 class="card-title text-xl">Recent Activity</h2>
								<p class="text-xs text-base-content/50">Last 30 games played</p>
							</div>
						</div>
						<div class="mb-3 h-px bg-linear-to-r from-success/20 to-transparent"></div>

						{#if data.stats.recentActivity.length === 0}
							<div class="py-10 text-center text-base-content/60">
								<p class="text-base font-medium">No recent activity</p>
							</div>
						{:else}
							<div class="max-h-64 overflow-y-auto">
								<div class="flex flex-col gap-2">
									{#each data.stats.recentActivity as activity (activity.date)}
										<div
											class="flex items-center justify-between rounded-lg bg-base-200/50 px-4 py-2"
										>
											<div class="flex items-center gap-3">
												<span
													class="font-mono text-sm font-semibold {activity.winner
														? 'text-success'
														: 'text-base-content/40'}"
												>
													{activity.score === 7 ? 'DNF' : activity.score + '/6'}
												</span>
												<span class="text-xs text-base-content/50">
													{activity.winner ? 'Won' : 'Lost'}
												</span>
											</div>
											<span class="text-xs text-base-content/50">
												{new Date(activity.date).toLocaleDateString(undefined, {
													month: 'short',
													day: 'numeric',
													hour: '2-digit',
													minute: '2-digit',
												})}
											</span>
										</div>
									{/each}
								</div>
							</div>
						{/if}
					</div>
				</section>
			</div>
		</section>
	</div>
</div>
