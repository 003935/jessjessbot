<script lang="ts">
	import type { PageProps } from './$types';
	import { addGameRole, getGameRoles, removeGameRole } from '$lib/gameRole.remote';

	let { data }: PageProps = $props();

	let dialog: HTMLDialogElement;

	let gameName_input = $state('');
	let roleId_input = $state('');

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
							{#each query.current as game (game.roleId + game.guildId + game.gameName)}
								<tr>
									<td>{game.gameName}</td>
									<td class:text-error={!game.role}>
										{game.role?.name ?? `Role ${game.roleId} not found`}
									</td>
									<td>
										<button
											class="btn btn-sm btn-error"
											onclick={async () => {
												const confirm = window.confirm(
													'Are you sure you want to remove this game?'
												);
												if (!confirm) return;
												try {
													await removeGameRole({
														guildId: data.guild.id,
														roleId: game.roleId,
													}).updates(
														getGameRoles(data.guild.id).withOverride((arr) => {
															arr.filter((ge) => ge.roleId !== game.roleId);
															return arr;
														})
													);
												} catch (error) {
													console.log(error);
												}
											}}
										>
											Remove
										</button>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
			<button class="btn btn-primary" onclick={() => dialog.showModal()}>Add Event Game</button>
		</div>
	</div>
</div>

<dialog bind:this={dialog} class="modal">
	<div class="modal-box">
		<h3 class="text-lg font-bold">Add Game Role</h3>
		<fieldset class="fieldset">
			<legend class="fieldset-legend">Game Name</legend>
			<select class="select" bind:value={gameName_input}>
				{#each data.games as game}
					<option value={game.name}>{game.name}</option>
				{/each}
			</select>
		</fieldset>
		<fieldset class="fieldset">
			<legend class="fieldset-legend">Role Id</legend>
			<select class="select" bind:value={roleId_input}>
				{#each data.guild.roles as role}
					<option value={role.id}>{role.name}</option>
				{/each}
			</select>
		</fieldset>
		<div class="modal-action">
			<form method="dialog">
				<button
					class="btn"
					onclick={async () => {
						try {
							await addGameRole({
								guildId: data.guild.id,
								gameName: gameName_input,
								roleId: roleId_input,
							}).updates(
								getGameRoles(data.guild.id).withOverride((arr) => {
									arr.push({
										guildId: data.guild.id,
										gameName: gameName_input,
										roleId: roleId_input,
										role: data.guild.roles.find((role) => role.id === roleId_input),
									});
									return arr;
								})
							);
						} catch (error) {
							console.log(error);
						}
					}}
				>
					Add
				</button>
			</form>
		</div>
	</div>
</dialog>
