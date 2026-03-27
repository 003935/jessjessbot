<script lang="ts">
	import type { PageProps } from './$types';
	import { getGameRoles } from '$lib/gameRole.remote';
	import GameRoleDialog from '$lib/components/GameRoleDialog.svelte';
	import PencilIcon from '@lucide/svelte/icons/pencil';

	let { data }: PageProps = $props();

	let dialog: GameRoleDialog;

	const query = $derived(getGameRoles(data.guild.id));
</script>

<div class="container mx-auto flex flex-col gap-6 py-12">
	<div class="flex items-center gap-4">
		<div class="avatar">
			<div class="mask w-16 mask-squircle">
				{#if data.guild?.icon}
					<img src={data.guild.icon} alt="" />
				{/if}
			</div>
		</div>
		<h1 class="text-2xl font-bold">{data.guild.name}</h1>
	</div>
	<div class="card w-96 bg-base-200 shadow-sm">
		<div class="card-body">
			<h2 class="card-title">Game Roles</h2>
			{#if query.error}
				<p class="text-error">Failed to load game roles</p>
			{:else if query.loading}
				<span class="loading loading-lg self-center loading-ring py-12"></span>
			{:else if query.current?.length === 0}
				<p>No game roles added</p>
			{:else}
				<div class="overflow-x-auto">
					<table class="table">
						<!-- head -->
						<thead>
							<tr>
								<th>Name</th>
								<th>Role</th>
								<th></th>
							</tr>
						</thead>
						<tbody>
							{#each query.current as game_role (game_role.roleId + game_role.guildId + game_role.gameName)}
								<tr>
									<td>{game_role.gameName}</td>
									<td class:text-error={!game_role.role}>
										{game_role.role?.name ?? `Role ${game_role.roleId} not found`}
									</td>
									<td class="flex justify-end">
										<button
											class="btn btn-ghost btn-sm"
											onclick={() => {
												dialog.open(game_role);
											}}
										>
											<PencilIcon size={12} />
										</button>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
			<button class="btn btn-primary" onclick={() => dialog.open()}>Add Event Game</button>
		</div>
	</div>
</div>

<GameRoleDialog
	bind:this={dialog}
	games={data.games}
	roles={data.guild.roles}
	guildId={data.guild.id}
/>
