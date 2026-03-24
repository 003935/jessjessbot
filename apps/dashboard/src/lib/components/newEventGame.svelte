<script lang="ts">
	import { getEmojis } from '$lib/discord.remote';
	import { addEventGame, getEventGames } from '$lib/eventGame.remote';

	let dialog: HTMLDialogElement;
	let submitting = $state(false);
	let gameName_input = $state('');
	let gameIcon_input = $state('');
	let error = $state('');
</script>

<button
	class="btn btn-primary"
	onclick={() => {
		dialog.showModal();
	}}
>
	Add Game
</button>

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
		<fieldset class="fieldset">
			<legend class="fieldset-legend">Icon</legend>
			<select required disabled={submitting} bind:value={gameIcon_input} class="select">
				<option value="">Select Icon</option>
				{#each await getEmojis() as emoji}
					<option value={emoji.id}>
						<img
							src={`https://cdn.discordapp.com/emojis/${emoji.id}.webp?size=96&quality=lossless${emoji.animated ? '&animated=true' : ''}`}
							alt=""
							class="w-8"
						/>
						{emoji.name}
					</option>
				{/each}
			</select>
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
						await addEventGame({
							gameName: gameName_input,
							icon: gameIcon_input,
						}).updates(
							getEventGames().withOverride((arr) => {
								arr?.push({
									name: gameName_input,
									icon: gameIcon_input,
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
