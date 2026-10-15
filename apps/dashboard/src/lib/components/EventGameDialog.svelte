<script lang="ts">
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
		Field as SField,
		Form,
		reset,
		submit,
		type SubmitEventHandler,
	} from '@formisch/svelte';
	import { isHttpError } from '@sveltejs/kit';
	import Gamepad2 from '@lucide/svelte/icons/gamepad-2';
	import Image from '@lucide/svelte/icons/image';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import { Button } from './ui/button';
	import { Spinner } from './ui/spinner';
	import { Input } from './ui/input';
	import * as Select from '$lib/components/ui/select/index.js';
	import type { APIApplicationEmoji } from 'discord-api-types/v10';
	import { EventGame_Schema, type EventGame } from '$lib/eventGame.utils';

	let dialog: DialogWithConfirm;

	let { emojis }: { emojis: APIApplicationEmoji[] } = $props();

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
			let submit_promise: Promise<void>;

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
					getEventGames().withOverride((arr) => [
						...arr,
						{
							name: output.name,
							icon: output.icon,
						},
					])
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
	<Dialog.Header>
		<Dialog.Title>
			{#if old_state}Edit Event Game{:else}Add Event Game{/if}
		</Dialog.Title>
		<Dialog.Description>
			{#if old_state}{old_state?.name}{/if}
		</Dialog.Description>
	</Dialog.Header>
	<Form of={form} onsubmit={handleSubmit} class="flex flex-col gap-4">
		<SField of={form} path={['name']}>
			{#snippet children(field)}
				<Field.Field data-invalid={field.errors ? 'true' : undefined}>
					<Field.Label>
						<Gamepad2 />
						Game Name
					</Field.Label>
					<Input
						{...field.props}
						value={field.input}
						type="text"
						placeholder="Enter game name"
						aria-invalid={field.errors ? 'true' : undefined}
					/>
					{#if field.errors}
						<Field.Error>
							{field.errors[0]}
						</Field.Error>
					{/if}
				</Field.Field>
			{/snippet}
		</SField>

		<SField of={form} path={['icon']}>
			{#snippet children(field)}
				<Field.Field data-invalid={field.errors ? 'true' : undefined}>
					<Field.Label>
						<Image />
						Icon Emoji
					</Field.Label>
					<Select.Root
						type="single"
						{...field.props}
						value={field.input}
						onValueChange={(value) => field.onInput(value)}
					>
						<Select.Trigger class="w-45">
							{#if field.input}
								{@const emoji = emojis.find((e) => e.id === field.input)}
								{#if emoji}
									<div class="flex items-center gap-2">
										<img
											src={`https://cdn.discordapp.com/emojis/${emoji.id}.webp?size=96&quality=lossless${emoji.animated ? '&animated=true' : ''}`}
											alt=""
											class="h-6 w-6"
										/>
										{emoji.name}
									</div>
								{:else}
									<p class="text-destructive">Invalid emoji selected</p>
								{/if}
							{:else}
								Select an emoji icon
							{/if}
						</Select.Trigger>
						<Select.Content>
							{#each emojis as emoji (emoji.id)}
								<Select.Item value={emoji.id}>
									<div class="flex items-center gap-2">
										<img
											src={`https://cdn.discordapp.com/emojis/${emoji.id}.webp?size=96&quality=lossless${emoji.animated ? '&animated=true' : ''}`}
											alt=""
											class="h-6 w-6"
										/>
										{emoji.name}
									</div>
								</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
					{#if field.errors}
						<Field.Error>
							{field.errors[0]}
						</Field.Error>
					{/if}
				</Field.Field>
			{/snippet}
		</SField>
	</Form>
	<Dialog.Footer>
		{#if old_state !== null}
			<Button
				class="mr-auto"
				variant="destructive"
				disabled={form.isSubmitting}
				onclick={() => dialog.openConfirm()}
			>
				<Trash2 />
				Delete
			</Button>
		{/if}
		<Button
			disabled={form.isSubmitting || (old_state && !form.isDirty)}
			onclick={() => submit(form)}
		>
			{#if form.isSubmitting}
				<Spinner />
			{/if}
			Save
		</Button>
		<Button variant="outline" disabled={form.isSubmitting} onclick={() => dialog.close()}>
			Cancel
		</Button>
	</Dialog.Footer>
	{#snippet confirmMessage()}
		Are you sure you want to delete <strong class="text-base-content">{old_state?.name}</strong>
		?
	{/snippet}
</DialogWithConfirm>
