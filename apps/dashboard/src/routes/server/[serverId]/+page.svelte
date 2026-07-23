<script lang="ts">
	import type { PageProps } from './$types';
	import { getGameRoles } from '$lib/gameRole.remote';
	import GameRoleDialog from '$lib/components/GameRoleDialog.svelte';
	import WordleImport from '$lib/components/WordleImport.svelte';
	import WordleScoreDist from '$lib/components/WordleScoreDist.svelte';
	import WordleLeaderboard from '$lib/components/WordleLeaderboard.svelte';
	import FailedMentionsTable from '$lib/components/FailedMentionsTable.svelte';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Shield from '@lucide/svelte/icons/shield';
	import Plus from '@lucide/svelte/icons/plus';
	import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Hash from '@lucide/svelte/icons/hash';
	import BarChart3 from '@lucide/svelte/icons/bar-chart-3';
	import Wrench from '@lucide/svelte/icons/wrench';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { getGuildSummary, getWordleStats } from '$lib/wordle.remote';
	import Trophy from '@lucide/svelte/icons/trophy';
	import {
		AlertCircleIcon,
		CircleAlertIcon,
		FrownIcon,
		Gamepad2,
		ImageIcon,
		ImageOffIcon,
		Target,
		UsersIcon,
	} from '@lucide/svelte';
	import OldCard from '$lib/components/Card.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Empty from '$lib/components/ui/empty/index.js';
	import StatCard from '$lib/components/stat-card.svelte';
	import Spinner from '$lib/components/ui/spinner/spinner.svelte';
	import * as Alert from '$lib/components/ui/alert/index.js';
	import ServerConfig from '$lib/components/ServerConfig.svelte';

	let { data }: PageProps = $props();

	let dialog: GameRoleDialog | undefined = $state();

	const grQuery = $derived(getGameRoles(data.guild.id));

	const wsQuery = $derived(getWordleStats(data.guild.id));

	const gsquery = $derived(getGuildSummary(data.guild.id));
</script>

{#snippet gr(game_role: NonNullable<typeof grQuery.current>[number], loading: boolean = false)}
	{@const game = data.games.find((g) => g.name === game_role.gameName)}
	{@const emoji = game ? data.emojis.find((e) => e.id === game.icon) : null}
	<div
		class="flex items-center justify-between rounded-lg bg-accent px-3 py-2 text-accent-foreground"
	>
		<div class="flex flex-1 items-center justify-start gap-2">
			{#if loading}
				<Spinner />
				<div class="skeleton skeleton-text">Loading...</div>
			{:else}
				<div class=" flex size-6 shrink-0 items-center justify-center rounded-lg">
					{#if emoji}
						<img
							src={`https://cdn.discordapp.com/emojis/${emoji.id}.webp?size=96&quality=lossless${emoji.animated ? '&animated=true' : ''}`}
							alt=""
							loading="lazy"
						/>
					{:else}
						<ImageOffIcon />
					{/if}
				</div>
				<span class="truncate font-semibold">{game_role.gameName}</span>
			{/if}
		</div>
		<div class="flex shrink-0 items-center gap-2.5">
			{#if loading}
				<Spinner />
			{:else if game_role.roleName}
				<div
					class="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/10 px-3 py-1.5 text-primary"
				>
					@{game_role.roleName}
				</div>
			{:else}
				<Alert.Root variant="destructive">
					<CircleAlertIcon />
					<Alert.Title>Not found</Alert.Title>
				</Alert.Root>
			{/if}
			<Button variant="outline" size="icon" onclick={() => dialog?.open(game_role)}>
				<Pencil />
			</Button>
		</div>
	</div>
{/snippet}

<div class="container mx-auto flex h-fit max-w-7xl flex-col gap-12 px-4 py-8">
	<div class="flex items-center justify-between">
		<Button onclick={() => goto(resolve('/'))} variant="ghost">
			<ArrowLeft />
			Back to home
		</Button>
		<div class="flex items-center gap-4">
			<div class="text-end text-2xl font-bold">
				{data.guild.name}
			</div>
			<div class="size-20">
				{#if data.guild?.icon}
					<img src={data.guild.icon} alt="" class="rounded-lg" />
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
				<StatCard icon={{ component: UsersIcon }} title="Players" query={gsquery}>
					{#snippet value({ totalPlayers })}
						{totalPlayers}
					{/snippet}
				</StatCard>

				<StatCard icon={{ component: Gamepad2 }} title="Games" query={gsquery}>
					{#snippet value({ totalGames })}
						{totalGames}
					{/snippet}
				</StatCard>

				<StatCard icon={{ component: Trophy }} title="Wins" query={gsquery}>
					{#snippet value({ totalWins })}
						{totalWins}
					{/snippet}
				</StatCard>

				<StatCard icon={{ component: Target }} title="Avg Score" query={gsquery}>
					{#snippet value({ avgScore })}
						{avgScore !== null ? avgScore.toFixed(1) : 'N/A'}
					{/snippet}
				</StatCard>

				<StatCard icon={{ component: Trophy }} title="Avg Win" query={gsquery}>
					{#snippet value({ avgWinningScore })}
						{avgWinningScore !== null ? avgWinningScore.toFixed(1) : 'N/A'}
					{/snippet}
				</StatCard>
			</div>
		</div>

		<Card.Root>
			<Card.Header>
				<Card.Title>Score Distribution</Card.Title>
				<Card.Description>
					{#if wsQuery.loading}
						Loading...
					{:else if wsQuery.ready}
						{#if wsQuery.current.total > 0}
							{wsQuery.current.total} total scores
						{:else}
							No data
						{/if}
					{/if}
				</Card.Description>
			</Card.Header>
			<Card.Content class="flex h-64">
				{#if wsQuery.error}
					<Empty.Root>
						<Empty.Header>
							<Empty.Title>Error</Empty.Title>
							<Empty.Description>Failed to load wordle statistics</Empty.Description>
						</Empty.Header>
					</Empty.Root>
				{:else if wsQuery.loading}
					<div class="flex animate-pulse items-center justify-center py-10">
						<div class="bg-base-300 h-64 w-full rounded"></div>
					</div>
				{:else if wsQuery.ready}
					{#if wsQuery.current.total > 0}
						<WordleScoreDist
							class="h-full w-full"
							data={wsQuery.current.dist.map((d) => ({
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
				{/if}
			</Card.Content>
		</Card.Root>
		<WordleLeaderboard serverId={data.guild.id} />
	</div>

	{#if data.isAdmin}
		<div class="grid grid-cols-2 gap-4">
			<div class="col-span-2 flex items-center gap-3">
				<div>
					<Wrench size={22} />
				</div>
				<h2 class="text-2xl font-bold">Management</h2>
			</div>

			<ServerConfig
				channels={data.channels ?? []}
				config={{ custom_channel: data.config?.custom_channel ?? undefined }}
				guildId={data.guild.id}
			/>

			<Card.Root>
				<Card.Header>
					<Card.Title>Game Roles</Card.Title>
					<Card.Description>
						{#if grQuery.loading}
							Loading...
						{:else if grQuery.ready}
							{grQuery.current.length} configured
						{/if}
					</Card.Description>
					<Card.Action>
						<Button onclick={() => dialog?.open()} disabled={!grQuery.ready}>
							<Plus />
							Add Role
						</Button>
					</Card.Action>
				</Card.Header>
				<Card.Content class="flex h-64 flex-col gap-2 overflow-y-auto">
					{#if grQuery.error}
						<Empty.Root>
							<Empty.Header>
								<Empty.Title>Error</Empty.Title>
								<Empty.Description>Failed to load game roles</Empty.Description>
							</Empty.Header>
						</Empty.Root>
					{:else if grQuery.loading}
						{#each Array(6) as _, i (i)}
							{@render gr({ gameName: '', roleId: '' }, true)}
						{/each}
					{:else if grQuery.ready}
						{#if grQuery.current.length > 0}
							{#each grQuery.current as game_role (game_role.roleId + game_role.gameName)}
								{@render gr(game_role)}
							{/each}
						{:else}
							<Empty.Root>
								<Empty.Header>
									<Empty.Title>No data</Empty.Title>
									<Empty.Description>No game roles configured yet</Empty.Description>
								</Empty.Header>
							</Empty.Root>
						{/if}
					{/if}
				</Card.Content>
			</Card.Root>

			<WordleImport serverId={data.guild.id} wordleImport={data.wordleImport} />
		</div>
	{/if}
</div>

<GameRoleDialog
	bind:this={dialog}
	games={data.games}
	roles={data.guild.roles}
	guildId={data.guild.id}
/>
