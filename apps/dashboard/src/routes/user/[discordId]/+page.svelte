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
	import { XIcon } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { forgetEverythingAboutMe, forgetMyFact, setMyAutoMemory } from '$lib/personality.remote';

	let { data }: PageProps = $props();

	let totalScores = $derived(
		data.stats.scoreDistribution.reduce((prev, curr) => prev + curr.count, 0)
	);

	// Follows the page data (switching servers) but can be updated after a delete.
	let memory = $derived(data.memory);
	let confirmingForget = $state(false);

	async function deleteFact(id: string) {
		if (!memory || !data.serverId) return;
		try {
			await forgetMyFact({ guildId: data.serverId, userId: data.discordId, id });
			memory = {
				...memory,
				facts: memory.facts.filter((fact) => fact.id !== id),
				past: memory.past.filter((fact) => fact.id !== id),
			};
		} catch {
			toast.error('Could not delete that one');
		}
	}

	async function toggleAutoMemory() {
		if (!memory || !data.serverId) return;
		const enabled = !memory.autoMemory;
		try {
			await setMyAutoMemory({ guildId: data.serverId, userId: data.discordId, enabled });
			memory = { ...memory, autoMemory: enabled };
		} catch {
			toast.error('Could not change that');
		}
	}

	async function forgetEverything() {
		if (!memory || !data.serverId) return;
		try {
			await forgetEverythingAboutMe({ guildId: data.serverId, userId: data.discordId });
			memory = {
				...memory,
				facts: [],
				past: [],
				likes: [],
				dislikes: [],
				pets: [],
				favourites: [],
				birthday: null,
			};
			confirmingForget = false;
		} catch {
			toast.error('Could not forget everything');
		}
	}
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
	{#if !data.serverId && data.memoryServers.length}
		<Card.Root class="mb-8">
			<Card.Header>
				<Card.Title>What jjb remembers about you</Card.Title>
				<Card.Description>Pick a server to see and delete what she saved there.</Card.Description>
			</Card.Header>
			<Card.Content class="flex flex-wrap gap-2">
				{#each data.memoryServers as server (server.id)}
					<Button
						variant="outline"
						onclick={() => goto(resolve(`/user/${data.discordId}?serverId=${server.id}`))}
					>
						{server.name}
					</Button>
				{/each}
			</Card.Content>
		</Card.Root>
	{/if}

	{#if memory}
		<Card.Root class="mb-8">
			<Card.Header>
				<Card.Title>What jjb remembers about you</Card.Title>
				<Card.Description>
					jjb only remembers things from chats she was part of. delete anything you don't want her
					to know.
				</Card.Description>
				<Card.Action>
					<Button variant="outline" onclick={toggleAutoMemory}>
						{memory.autoMemory
							? 'Stop remembering stuff about me'
							: 'Let jjb remember stuff about me'}
					</Button>
				</Card.Action>
			</Card.Header>
			<Card.Content class="flex flex-col gap-4">
				<p class="text-sm text-muted-foreground">
					Auto memory is {memory.autoMemory ? 'on' : 'off'}.
				</p>
				{#if memory.facts.length === 0}
					<p class="text-sm text-muted-foreground">She hasn't saved anything about you.</p>
				{:else}
					<div class="flex max-h-80 flex-col gap-2 overflow-y-auto">
						{#each memory.facts as fact (fact.id)}
							<div class="flex items-start justify-between gap-3 rounded-lg border p-2">
								<p class="min-w-0 flex-1 text-sm">
									{fact.text}
									<span class="text-xs text-muted-foreground">· {fact.label}</span>
								</p>
								<Button
									variant="ghost"
									size="icon"
									aria-label={`Delete: ${fact.text}`}
									onclick={() => deleteFact(fact.id)}
								>
									<XIcon />
								</Button>
							</div>
						{/each}
					</div>
				{/if}
				{#if memory.past.length}
					<details>
						<summary class="cursor-pointer text-sm text-muted-foreground">
							Past, replaced by newer things ({memory.past.length})
						</summary>
						<div class="mt-2 flex max-h-60 flex-col gap-2 overflow-y-auto">
							{#each memory.past as fact (fact.id)}
								<div class="flex items-start justify-between gap-3 rounded-lg border p-2">
									<p class="min-w-0 flex-1 text-sm text-muted-foreground">
										{fact.text}
										<span class="text-xs">· {fact.label}</span>
									</p>
									<Button
										variant="ghost"
										size="icon"
										aria-label={`Delete: ${fact.text}`}
										onclick={() => deleteFact(fact.id)}
									>
										<XIcon />
									</Button>
								</div>
							{/each}
						</div>
					</details>
				{/if}
				{#if memory.pets.length || memory.favourites.length || memory.birthday || memory.likes.length || memory.dislikes.length}
					<div class="flex flex-col gap-1 text-sm">
						{#if memory.birthday}<p>Birthday: {memory.birthday}</p>{/if}
						{#if memory.pets.length}<p>Pets: {memory.pets.join(', ')}</p>{/if}
						{#if memory.favourites.length}<p>Favourites: {memory.favourites.join(', ')}</p>{/if}
						{#if memory.likes.length}<p>Likes: {memory.likes.join(', ')}</p>{/if}
						{#if memory.dislikes.length}<p>Dislikes: {memory.dislikes.join(', ')}</p>{/if}
					</div>
				{/if}
				<div class="flex items-center gap-2">
					{#if confirmingForget}
						<span class="text-sm">This also removes your lines from chats she saved.</span>
						<Button variant="destructive" onclick={forgetEverything}>Yes, forget everything</Button>
						<Button variant="ghost" onclick={() => (confirmingForget = false)}>Cancel</Button>
					{:else}
						<Button variant="destructive" onclick={() => (confirmingForget = true)}>
							Forget everything
						</Button>
					{/if}
				</div>
			</Card.Content>
		</Card.Root>
	{/if}
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
