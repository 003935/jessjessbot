<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageProps } from './$types';
	import { getEventGames } from '$lib/eventGame.remote';
	import { authClient } from '$lib/auth.client';
	import EventGameDialog from '$lib/components/EventGameDialog.svelte';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import { onDestroy, onMount } from 'svelte';

	let { data }: PageProps = $props();

	const canListGames = $derived(
		data.user === null
			? false
			: authClient.admin.checkRolePermission({
					permissions: {
						game: ['list'],
					},
					role: data.user.role,
				})
	);

	const canManageGames = $derived(
		data.user === null
			? false
			: authClient.admin.checkRolePermission({
					permissions: {
						game: ['manage'],
					},
					role: data.user.role,
				})
	);

	let eventGameDialog: EventGameDialog | undefined = $state();

	const query = $derived(canListGames ? getEventGames() : null);

	let now = $state(Date.now());

	let interval = $state<ReturnType<typeof setInterval>>();

	onMount(() => {
		interval = setInterval(() => {
			now = Date.now();
		}, 1000);
	});

	onDestroy(() => clearInterval(interval));

	function formatCountdown(targetTime: Date) {
		const diff = targetTime.getTime() - now;
		if (diff <= -5000) return null;
		else if (diff <= 0) return 'Now';

		const h = Math.floor(diff / 3_600_000);
		const m = Math.floor((diff % 3_600_000) / 60_000);
		const s = Math.floor((diff % 60_000) / 1_000);

		return [h, m, s];
	}
</script>

<div class="container mx-auto grid grid-cols-1 gap-6 py-12 lg:grid-cols-2">
	{#if data.servers}
		<div class="flex flex-row gap-2 lg:col-span-2">
			{#each data.servers as server (server.id)}
				<button class="btn w-max btn-neutral" onclick={() => goto(`/server/${server.id}`)}>
					<div class="avatar">
						<div class="mask w-8 mask-squircle">
							<img src={server.icon} alt="" />
						</div>
					</div>
					<div>{server.name}</div>
				</button>
			{/each}
		</div>
	{/if}
	{#if canListGames && query}
		<div class="card min-w-96 bg-base-200 shadow-sm">
			<div class="card-body">
				<h2 class="card-title">Event Games</h2>
				{#if query.error}
					<p class="text-error">Failed to load event games</p>
				{:else if query.loading}
					<span class="loading loading-lg self-center loading-ring py-12"></span>
				{:else if query.current?.length === 0}
					<p>No event games added</p>
				{:else}
					<div class="overflow-x-auto">
						<table class="table">
							<thead>
								<tr>
									<th>Icon</th>
									<th>Name</th>
									{#if canManageGames}
										<th></th>
									{/if}
								</tr>
							</thead>
							<tbody>
								{#each query.current as game (game.name)}
									{@const emoji = game.icon
										? data.emojis.find((e) => e.id === game.icon)
										: undefined}
									<tr>
										<td>
											{#if emoji}
												<img
													src={`https://cdn.discordapp.com/emojis/${emoji.id}.webp?size=96&quality=lossless${emoji.animated ? '&animated=true' : ''}`}
													alt=""
													class="size-8"
												/>
											{:else}
												<div class="text-neutral">No icon</div>
											{/if}
										</td>
										<td>{game.name}</td>
										{#if canManageGames}
											<td class="flex justify-end">
												<button
													class="btn btn-ghost btn-sm"
													onclick={() => {
														eventGameDialog?.open(game);
													}}
												>
													<PencilIcon size={12} />
												</button>
											</td>
										{/if}
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
				{#if canManageGames}
					<button
						class="btn btn-primary"
						onclick={() => {
							eventGameDialog?.open();
						}}
					>
						Add Game
					</button>
				{/if}
			</div>
		</div>
	{/if}
	<div class="card min-w-96 bg-base-200 shadow-sm">
		<div class="card-body">
			<h2 class="card-title">Customs</h2>
			<div class="overflow-x-auto">
				<table class="table">
					<thead>
						<tr>
							<th>Server</th>
							<th>Game</th>
							<th>Time</th>
						</tr>
					</thead>
					<tbody>
						{#if !data.customs || data.customs.length === 0}
							<tr>
								<td class="text-center" colspan="3">No customs</td>
							</tr>
						{/if}
						{#each data.customs as custom (custom.id)}
							{@const timer = formatCountdown(custom.scheduledTime)}
							{@const server = data.servers.find((s) => s.id === custom.guildId)}
							{#if timer !== null}
								<tr>
									<td>{server?.name || custom.guildId}</td>
									<td>{custom.gameName}</td>
									<td class="min-w-48">
										<div class="tooltip" data-tip={custom.scheduledTime.toLocaleString()}>
											{#if timer instanceof Array}
												{@const [h, m, s] = timer}
												<span class="countdown font-mono text-xl">
													<span style="--value:{h};" aria-live="polite">{h}</span>
													h
													<span style="--value:{m};" aria-live="polite">{m}</span>
													m
													<span style="--value:{s};" aria-live="polite">{s}</span>
													s
												</span>
											{:else if timer === 'Now'}
												<span class="text-error">Now</span>
											{/if}
										</div>
									</td>
								</tr>
							{/if}
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	</div>
</div>

{#if canManageGames}
	<EventGameDialog bind:this={eventGameDialog} />
{/if}
