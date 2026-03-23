<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageProps } from './$types';
	import { addGame, getGames, removeGame } from './page.remote';

	let { data }: PageProps = $props();

	const query = getGames();

	let dialog: HTMLDialogElement;

	let gameName_input = $state('');
	let submitting = $state(false);
	let error = $state('');
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
								<th>Name</th>
								<th></th>
							</tr>
						</thead>
						<tbody>
							{#each query.current as game (game.name)}
								<tr>
									<td>{game.name}</td>
									<td>
										<button
											class="btn btn-sm btn-error"
											onclick={async () => {
												const confirm = window.confirm(
													'Are you sure you want to remove this game?'
												);
												if (!confirm) return;
												try {
													await removeGame(game.name).updates(
														getGames().withOverride((arr) =>
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
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
			<button
				class="btn btn-primary"
				onclick={() => {
					dialog.showModal();
				}}
			>
				Add Game
			</button>
		</div>
	</div>
</div>

<dialog bind:this={dialog} class="modal">
	<div class="modal-box">
		<h3 class="text-lg font-bold">Add Event Game</h3>
		<fieldset class="fieldset">
			<legend class="fieldset-legend">Game Name</legend>
			<input
				required
				disabled={submitting}
				type="text"
				bind:value={gameName_input}
				class="input"
				placeholder="Game Name"
			/>
		</fieldset>
		{#if error.length > 0}
			<p class="text-error">{error}</p>
		{/if}
		<div class="modal-action">
			<button
				class="btn"
				disabled={submitting}
				onclick={async () => {
					try {
						submitting = true;
						await addGame(gameName_input).updates(
							getGames().withOverride((arr) => {
								arr.push({
									name: gameName_input,
								});
								return arr;
							})
						);
						dialog.close();
						gameName_input = '';
						error = '';
					} catch (error) {
						console.log(error);
						error = 'Failed to add game';
					} finally {
						submitting = false;
					}
				}}
			>
				{#if submitting}
					<span class="loading loading-spinner"></span>
				{/if}
				Add
			</button>
		</div>
	</div>
</dialog>
