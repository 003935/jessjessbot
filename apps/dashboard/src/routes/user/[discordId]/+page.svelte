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
	import { Button } from '$lib/components/ui/button';
	import { BarChart3, Gamepad2, ImageIcon, UsersIcon } from '@lucide/svelte';
	import StatCard from '$lib/components/stat-card.svelte';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Empty from '$lib/components/ui/empty/index.js';
	import { cn } from '$lib/utils';

	let { data }: PageProps = $props();

	let totalScores = $derived(
		data.stats.scoreDistribution.reduce((prev, curr) => prev + curr.count, 0)
	);
</script>

<div class="container mx-auto h-fit max-w-7xl px-4 py-8">
	<div class="mb-12 flex items-center justify-between">
		{#if data.serverId}
			<Button onclick={() => goto(resolve(`/server/${data.serverId}`))} variant="ghost">
				<ArrowLeft />
				Back to server
			</Button>
		{:else}
			<Button onclick={() => goto(resolve(`/`))} variant="ghost">
				<ArrowLeft />
				Back to home
			</Button>{/if}
		<div class="flex items-center gap-4">
			<div class="text-end text-2xl font-bold">
				{data.displayName}
			</div>
			<div class="size-20">
				{#if data.avatarUrl}
					<img src={data.avatarUrl} alt="" class="rounded-lg" />
				{:else}
					<ImageIcon />
				{/if}
			</div>
		</div>
	</div>
	<div class="grid grid-cols-2 gap-4">
		<div class="col-span-2 flex items-center gap-3">
			<div>
				<BarChart3 size={22} />
			</div>
			<h2 class="text-2xl font-bold">Wordle Statistics</h2>
		</div>

		<div class="col-span-2">
			<div class="grid grid-cols-2 gap-4 md:grid-cols-5">
				<StatCard icon={{ component: Trophy }} title="Wins / Played" data={data.stats}>
					{#snippet value({ totalWins, totalGames })}
						{totalWins}
						<span class="text-sm font-normal text-muted-foreground">
							/ {totalGames}
						</span>
					{/snippet}
				</StatCard>

				<StatCard icon={{ component: Percent }} title="Win Rate" data={data.stats}>
					{#snippet value({ winRate })}
						{winRate.toFixed(1)}%
					{/snippet}
				</StatCard>

				<StatCard icon={{ component: Target }} title="Avg Score" data={data.stats}>
					{#snippet value({ averageScore })}
						{averageScore !== null ? averageScore.toFixed(1) : 'N/A'}
					{/snippet}
				</StatCard>

				<StatCard icon={{ component: Flame }} title="Best Streak" data={data.stats}>
					{#snippet value({ bestStreak })}
						{bestStreak}
					{/snippet}
				</StatCard>

				<StatCard icon={{ component: Flame }} title="Current Streak" data={data.stats}>
					{#snippet value({ currentStreak })}
						{currentStreak}
					{/snippet}
				</StatCard>
			</div>
		</div>

		<Card.Root>
			<Card.Header>
				<Card.Title>Score Distribution</Card.Title>
				<Card.Description>
					{#if totalScores > 0}
						{totalScores} total scores{:else}No data{/if}
				</Card.Description>
			</Card.Header>
			<Card.Content class="flex h-64">
				{#if totalScores > 0}
					<WordleScoreDist
						class="h-full w-full"
						data={data.stats.scoreDistribution.map((d) => ({
							score: d.score,
							value: d.count,
						}))}
					/>
				{:else}
					<Empty.Root>
						<Empty.Header>
							<Empty.Title>No data</Empty.Title>
							<Empty.Description>No wordle results recorded yet</Empty.Description>
						</Empty.Header>
					</Empty.Root>
				{/if}
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title>Recent Activity</Card.Title>
				<Card.Description>Last 30 games played</Card.Description>
			</Card.Header>
			<Card.Content
				class={cn('flex h-64 flex-col gap-2 overflow-y-auto', {
					'py-0.5': data.stats.recentActivity.length > 0,
				})}
			>
				{#if data.stats.recentActivity.length === 0}
					<Empty.Root>
						<Empty.Header>
							<Empty.Title>No data</Empty.Title>
							<Empty.Description>No recent activity</Empty.Description>
						</Empty.Header>
					</Empty.Root>
				{:else}
					{#each data.stats.recentActivity as activity (activity.date)}
						<div
							class="flex items-center justify-between rounded-lg bg-accent px-3 py-1.5 text-accent-foreground ring ring-border"
						>
							<div class="flex items-center gap-3">
								<span
									class={cn('font-mono text-sm font-semibold', {
										'text-yellow-300': activity.winner,
										'text-gray-500': activity.score === 7,
									})}
								>
									{activity.score === 7 ? 'DNF' : activity.score + '/6'}
								</span>
								<span class="text-xs">
									{activity.winner ? 'Won' : 'Lost'}
								</span>
							</div>
							<span class="text-xs text-muted-foreground">
								{new Date(activity.date).toLocaleDateString(undefined, {
									month: 'short',
									day: 'numeric',
									hour: '2-digit',
									minute: '2-digit',
								})}
							</span>
						</div>
					{/each}
				{/if}
			</Card.Content>
		</Card.Root>
	</div>
</div>
