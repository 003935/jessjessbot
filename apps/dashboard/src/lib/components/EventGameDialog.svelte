<script module lang="ts">
	import * as v from 'valibot';

	export const EventGame_Schema = v.object({
		name: v.pipe(
			v.string(),
			v.transform((value) => value.trim()),
			v.nonEmpty('Game name cannot be empty')
		),
		icon: v.pipe(
			v.string(),
			v.transform((value) => (value.length === 0 ? null : value))
		),
	});

	type EventGame = v.InferOutput<typeof EventGame_Schema>;
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
	import DialogWithConfirm from './ui/DialogWithConfirm.svelte';
	import {
		createForm,
		Field,
		Form,
		reset,
		submit,
		type SubmitEventHandler,
	} from '@formisch/svelte';
	import { isHttpError } from '@sveltejs/kit';
	import Gamepad2 from '@lucide/svelte/icons/gamepad-2';
	import Image from '@lucide/svelte/icons/image';
	import AlertCircle from '@lucide/svelte/icons/alert-circle';
	import Trash2 from '@lucide/svelte/icons/trash-2';

	let dialog: DialogWithConfirm;

	let old_state = $state<EventGame | null>(null);

	const form = createForm({
		schema: EventGame_Schema,
		initialInput: {
			name: '',
			icon: '',
		},
	});

	export function open(game?: EventGame) {
		if (game) {
			old_state = game;
			reset(form, {
				initialInput: {
					name: game.name,
					icon: game.icon ?? '',
				},
			});
		} else {
			old_state = null;
			reset(form, {
				initialInput: {
					name: '',
					icon: '',
				},
			});
		}
		dialog.open();
	}

	const handleSubmit: SubmitEventHandler<typeof EventGame_Schema> = async (output) => {
		const submission_id = crypto.randomUUID();
		try {
			let submit_promise: Promise<Promise<void>>;

			const old_object_copy = old_state ? { ...old_state } : null;

			if (old_object_copy) {
				submit_promise = updateEventGame({
					oldName: old_object_copy.name,
					name: output.name,
					icon: output.icon,
				}).updates(
					getEventGames().withOverride((arr) => {
						const index = arr?.findIndex((g) => g.name === old_object_copy.name);
						if (index !== -1) {
							arr![index] = {
								name: output.name,
								icon: output.icon,
							};
						}
						return arr;
					})
				);
			} else {
				submit_promise = addEventGame({
					name: output.name,
					icon: output.icon,
				}).updates(
					getEventGames().withOverride((arr) => {
						arr?.push({
							name: output.name,
							icon: output.icon,
						});
						return arr;
					})
				);
			}

			toast.promise(submit_promise, {
				id: submission_id,
				loading: old_state ? 'Updating game...' : 'Adding game...',
				success: old_state ? 'Game updated successfully' : 'Game added successfully',
				error: (error) => (isHttpError(error) ? error.body.message : 'Unknown error'),
			});

			await submit_promise;

			dialog.close();
		} catch (error) {
			toast.error(old_state ? 'Failed to update game' : 'Failed to add game', {
				id: submission_id,
				description: isHttpError(error) ? error.body.message : 'Unknown error',
			});
		}
	};

	async function handle_delete() {
		const deletion_id = crypto.randomUUID();
		try {
			const old_object_copy = old_state;

			if (!old_object_copy) {
				throw new Error('No game to delete');
			}

			let delete_promise = removeEventGame(old_object_copy.name).updates(
				getEventGames().withOverride((arr) => arr?.filter((g) => g.name !== old_object_copy.name))
			);

			toast.promise(delete_promise, {
				id: deletion_id,
				loading: 'Deleting game...',
				success: 'Game deleted successfully',
				error: (error) => (isHttpError(error) ? error.body.message : 'Unknown error'),
			});

			await delete_promise;

			dialog.close();
		} catch (error) {
			toast.error('Failed to delete game', {
				id: deletion_id,
				description: isHttpError(error) ? error.body.message : 'Unknown error',
			});
		}
	}
</script>

<DialogWithConfirm
	bind:this={dialog}
	onclose={() => {
		reset(form, {
			initialInput: {
				name: '',
				icon: '',
			},
		});
		old_state = null;
	}}
	confirmTitle="Confirm Delete"
	onconfirm={handle_delete}
>
	{#snippet confirmMessage()}
		Are you sure you want to delete <strong class="text-base-content">{old_state?.name}</strong>
		? This will remove it from all associated configurations.
	{/snippet}
	{#snippet icon()}
		<Gamepad2 size={24} class="text-primary" />
	{/snippet}
	{#snippet title()}
		{#if old_state}Edit Event Game{:else}Add Event Game{/if}
	{/snippet}
	{#snippet subtitle()}
		{#if old_state}{old_state?.name}{/if}
	{/snippet}

	<Form of={form} onsubmit={handleSubmit}>
		<Field of={form} path={['name']}>
			{#snippet children(field)}
				<fieldset class="fieldset rounded-xl">
					<legend class="fieldset-legend flex items-center gap-2 text-sm font-semibold">
						<Gamepad2 size={16} class="text-base-content/60" />
						Game Name
					</legend>
					<input
						{...field.props}
						value={field.input}
						type="text"
						class="input-bordered input w-full rounded-xl bg-base-200"
						placeholder="Enter game name"
					/>
					{#if field.errors}
						<div class="mt-1 flex items-center gap-1 text-sm text-error">
							<AlertCircle size={16} />
							{field.errors[0]}
						</div>
					{/if}
				</fieldset>
			{/snippet}
		</Field>

		<Field of={form} path={['icon']}>
			{#snippet children(field)}
				<fieldset class="fieldset rounded-xl">
					<legend class="fieldset-legend flex items-center gap-2 text-sm font-semibold">
						<Image size={16} class="text-base-content/60" />
						Icon Emoji
					</legend>
					<select
						{...field.props}
						value={field.input}
						class="select-bordered select w-full rounded-xl bg-base-200"
					>
						<option value="">Select an emoji icon</option>
						{#each await getEmojis() as emoji (emoji.id)}
							<option value={emoji.id}>
								<div class="flex items-center gap-2">
									<img
										src={`https://cdn.discordapp.com/emojis/${emoji.id}.webp?size=96&quality=lossless${emoji.animated ? '&animated=true' : ''}`}
										alt=""
										class="h-6 w-6"
									/>
									{emoji.name}
								</div>
							</option>
						{/each}
					</select>
					{#if field.errors}
						<div class="mt-1 flex items-center gap-1 text-sm text-error">
							<AlertCircle size={16} />
							{field.errors[0]}
						</div>
					{/if}
				</fieldset>
			{/snippet}
		</Field>
	</Form>
	{#snippet actions()}
		{#if old_state !== null}
			<button
				class="btn mr-auto rounded-lg btn-ghost btn-error"
				disabled={form.isSubmitting}
				onclick={() => dialog.openConfirm()}
			>
				<Trash2 size={16} />
				Delete
			</button>
		{/if}
		<button
			class="btn rounded-lg btn-primary"
			disabled={form.isSubmitting || (old_state && !form.isDirty)}
			onclick={() => submit(form)}
		>
			{#if form.isSubmitting}
				<span class="loading loading-xs loading-spinner"></span>
				Saving...
			{:else}
				Save
			{/if}
		</button>
		<button
			class="btn rounded-lg btn-ghost"
			disabled={form.isSubmitting}
			onclick={() => dialog.close()}
		>
			Cancel
		</button>
	{/snippet}
</DialogWithConfirm>
