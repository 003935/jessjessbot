<script lang="ts">
	import { addEventGame, getEventGames } from '$lib/eventGame.remote';

	let dialog: HTMLDialogElement;
	let submitting = $state(false);
	let gameName_input = $state('');
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
						}).updates(
							getEventGames().withOverride((arr) => {
								arr?.push({
									name: gameName_input,
									icon: null, //FIXME: Add icon upload
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
