<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageProps } from './$types';
	import { getEventGames, removeEventGame } from '$lib/eventGame.remote';
	import { authClient } from '$lib/auth.client';
	import NewEventGame from '$lib/components/newEventGame.svelte';

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

	const query = $derived(canListGames ? getEventGames() : null);
</script>

<div class="container mx-auto flex flex-col gap-6 py-12">
	{#if data.servers}
		<div class="flex flex-col gap-2">
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
		<div class="card w-96 bg-base-200 shadow-sm">
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
												/>
											{:else}
												<div class="text-neutral">No icon</div>
											{/if}
										</td>
										<td>{game.name}</td>
										{#if canManageGames}
											<td>
												<button
													class="btn btn-sm btn-error"
													onclick={async () => {
														const confirm = window.confirm(
															'Are you sure you want to remove this game?'
														);
														if (!confirm) return;
														try {
															await removeEventGame(game.name).updates(
																getEventGames().withOverride((arr) =>
																	arr.filter((g) => g.name !== game.name)
																)
															);
														} catch (error) {
															console.log(error);
														}
													}}
												>
													Remove
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
					<NewEventGame />
				{/if}
			</div>
		</div>
	{/if}
</div>
