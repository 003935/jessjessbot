<script module lang="ts">
	type EventGame = {
		name: string;
		icon: string | null;
	};

	async function update_game(old_object: EventGame, new_object: EventGame) {
		return await updateEventGame({
			oldName: old_object.name,
			gameName: new_object.name,
			icon: new_object.icon,
		}).updates(
			getEventGames().withOverride((arr) => {
				const index = arr?.findIndex((g) => g.name === old_object.name);
				if (index !== undefined) {
					arr[index] = {
						name: new_object.name,
						icon: new_object.icon,
					};
				}
				return arr;
			})
		);
	}

	async function add_game(new_object: EventGame) {
		return await addEventGame({
			gameName: new_object.name,
			icon: new_object.icon,
		}).updates(
			getEventGames().withOverride((arr) => {
				arr?.push({
					name: new_object.name,
					icon: new_object.icon,
				});
				return arr;
			})
		);
	}

	async function delete_game(name: string) {
		return await removeEventGame(name).updates(
			getEventGames().withOverride((arr) => arr?.filter((g) => g.name !== name))
		);
	}
</script>

<script lang="ts">
	import { getEmojis } from '$lib/discord.remote';
	import {
		addEventGame,
		getEventGames,
		removeEventGame,
		updateEventGame,
	} from '$lib/eventGame.remote';
	import { toast } from 'svelte-sonner';

	let dialog: HTMLDialogElement;

	let old_object = $state<EventGame | null>(null);

	export function open(game?: EventGame) {
		if (game) {
			old_object = game;
			gameName_input = game.name;
			gameIcon_input = game.icon ?? '';
		}
		dialog.show();
	}

	export function close() {
		dialog.close();
	}

	async function submit() {
		try {
			submitting = true;

			let submitPromise: Promise<void>;

			const old_object_copy = old_object ? { ...old_object } : null;
			const new_object = {
				name: gameName_input,
				icon: gameIcon_input,
			};

			if (old_object_copy) {
				submitPromise = update_game(old_object_copy, new_object);
			} else {
				submitPromise = add_game(new_object);
			}

			toast.promise(new Promise((resolve) => setTimeout(resolve, 500000)), {
				id: 'submit_game',
				loading: old_object ? 'Updating game...' : 'Adding game...',
			});

			await submitPromise;

			toast.success(old_object ? 'Game updated successfully' : 'Game added successfully', {
				id: 'submit_game',
				action: {
					label: 'Undo',
					onClick: () => {
						if (old_object_copy) {
							update_game(new_object, old_object_copy);
						} else {
							delete_game(new_object.name);
						}
					},
				},
			});

			dialog.close();
		} catch (error) {
			console.log(error);
			toast.error(old_object ? 'Failed to update game' : 'Failed to add game', {
				id: 'submit_game',
			});
		} finally {
			submitting = false;
		}
	}

	async function _delete() {
		try {
			submitting = true;

			const old_object_copy = old_object ? { ...old_object } : null;

			if (!old_object_copy) {
				throw new Error('No game to delete');
			}

			let deletePromise = removeEventGame(old_object_copy.name).updates(
				getEventGames().withOverride((arr) => arr?.filter((g) => g.name !== old_object_copy.name))
			);

			toast.promise(deletePromise, {
				loading: 'Deleting game...',
				success: 'Game deleted successfully',
				error: 'Failed to delete game',
				action: {
					label: 'Undo',
					onClick: () => {
						add_game(old_object_copy);
					},
				},
			});

			await deletePromise;

			dialog.close();
		} catch (error) {
			console.log(error);
		} finally {
			submitting = false;
		}
	}

	function reset() {
		old_object = null;
		gameName_input = '';
		gameIcon_input = '';
	}

	let submitting = $state(false);
	let gameName_input = $state('');
	let gameIcon_input = $state('');
</script>

<dialog
	bind:this={dialog}
	onclose={() => {
		setTimeout(reset, 300);
	}}
	class="modal"
>
	<div class="modal-box">
		<h3 class="text-lg font-bold">
			{old_object ? 'Edit' : 'Add'} Event Game
			{#if old_object}<span class="text-sm text-neutral">({old_object.name})</span>{/if}
		</h3>
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
		<div class="modal-action">
			{#if old_object !== null}
				<button
					class="btn mr-auto btn-error"
					disabled={submitting}
					onclick={() => {
						_delete();
					}}
				>
					Delete
				</button>
			{/if}
			<button class="btn btn-primary" disabled={submitting} onclick={submit}>
				{#if submitting}
					<span class="loading loading-spinner"></span>
				{/if}
				{old_object ? 'Update' : 'Add'}
			</button>
			<button class="btn btn-neutral" disabled={submitting} onclick={() => dialog.close()}>
				Cancel
			</button>
		</div>
	</div>
</dialog>
