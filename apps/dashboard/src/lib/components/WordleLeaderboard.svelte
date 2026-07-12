<script lang="ts">
	import { getGuildLeaderboard } from '$lib/wordle.remote';
	import Trophy from '@lucide/svelte/icons/trophy';
	import User from '@lucide/svelte/icons/user';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Empty from '$lib/components/ui/empty/index.js';
	import * as ToggleGroup from '$lib/components/ui/toggle-group/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import * as Avatar from '$lib/components/ui/avatar/index.js';

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

<Card.Root>
	<Card.Header>
		<Card.Title>Leaderboard</Card.Title>
		<Card.Description>
			Top 10 players {sortLabel[sortBy]}
		</Card.Description>
		<Card.Action>
			<ToggleGroup.Root type="single" bind:value={sortBy}>
				<ToggleGroup.Item value="byWins">Wins</ToggleGroup.Item>
				<ToggleGroup.Item value="byWinRate">Win Rate</ToggleGroup.Item>
				<ToggleGroup.Item value="byAvgScore">Avg Score</ToggleGroup.Item>
			</ToggleGroup.Root>
		</Card.Action>
	</Card.Header>
	<Card.Content class="flex h-64">
		{#if query.error}
			<Empty.Root>
				<Empty.Header>
					<Empty.Media variant="icon">
						<Trophy class="opacity-40" />
					</Empty.Media>
					<Empty.Title>Error</Empty.Title>
					<Empty.Description>Failed to load leaderboard</Empty.Description>
				</Empty.Header>
			</Empty.Root>
		{:else if query.loading || !query.current}
			<div class="max-h-64 overflow-y-auto">
				<div class="overflow-x-auto">
					<table class="table-sm table">
						<thead>
							<tr class="bg-base-100 sticky top-0 z-10">
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
									<td><div class="bg-base-300 h-4 w-6 animate-pulse rounded"></div></td>
									<td>
										<div class="flex items-center gap-2">
											<div class="bg-base-300 h-8 w-8 animate-pulse rounded-full"></div>
											<div class="bg-base-300 h-4 w-24 animate-pulse rounded"></div>
										</div>
									</td>
									<td class="text-right">
										<div class="bg-base-300 ml-auto h-4 w-10 animate-pulse rounded"></div>
									</td>
									<td class="text-right">
										<div class="bg-base-300 ml-auto h-4 w-12 animate-pulse rounded"></div>
									</td>
									<td class="text-right">
										<div class="bg-base-300 ml-auto h-4 w-10 animate-pulse rounded"></div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{:else if data.length === 0}
			<Empty.Root>
				<Empty.Header>
					<Empty.Media variant="icon">
						<Trophy class="opacity-40" />
					</Empty.Media>
					<Empty.Title>No Data</Empty.Title>
					<Empty.Description>No leaderboard data available</Empty.Description>
				</Empty.Header>
			</Empty.Root>
		{:else}
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>#</Table.Head>
						<Table.Head>Player</Table.Head>
						<Table.Head>Wins</Table.Head>
						<Table.Head>Win Rate</Table.Head>
						<Table.Head>Avg Score</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each data as entry, index (entry.discordId)}
						<Table.Row
							onclick={() => goto(resolve(`/user/${entry.discordId}?serverId=${serverId}`))}
						>
							<Table.Cell>{index + 1}</Table.Cell>
							<Table.Cell>
								<div class="flex items-center gap-2">
									<Avatar.Root>
										<Avatar.Image src={entry.avatarUrl} alt={entry.displayName} />
										<Avatar.Fallback>{entry.displayName.charAt(0)}</Avatar.Fallback>
									</Avatar.Root>
									<span
										class="group-hover:text-info font-semibold transition-all group-hover:underline"
									>
										{entry.displayName}
									</span>
								</div>
							</Table.Cell>
							<Table.Cell>{entry.wins}</Table.Cell>
							<Table.Cell>{entry.winRate.toFixed(1)}%</Table.Cell>
							<Table.Cell>
								{#if entry.avgScore !== null}
									{entry.avgScore.toFixed(1)}
								{:else}
									N/A
								{/if}
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		{/if}
	</Card.Content>
</Card.Root>
