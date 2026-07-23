<script module lang="ts">
	import * as v from 'valibot';

	export const GameRole_Schema = v.object({
		roleId: v.pipe(
			v.string(),
			v.transform((value) => value.trim()),
			v.nonEmpty('Role cannot be empty')
		),
		gameName: v.pipe(
			v.string(),
			v.transform((value) => value.trim()),
			v.nonEmpty('Game name cannot be empty')
		),
	});

	type GameRole = v.InferOutput<typeof GameRole_Schema>;
</script>

<script lang="ts">
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
	import { addGameRole, getGameRoles, removeGameRole, updateGameRole } from '$lib/gameRole.remote';
	import Shield from '@lucide/svelte/icons/shield';
	import Gamepad2 from '@lucide/svelte/icons/gamepad-2';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import * as Dialog from './ui/dialog';
	import { Button } from './ui/button';
	import { Spinner } from './ui/spinner';
	import * as Select from '$lib/components/ui/select/index.js';
	import * as Field from '$lib/components/ui/field/index.js';

	const form = createForm({
		schema: GameRole_Schema,
		initialInput: {
			roleId: '',
			gameName: '',
		},
	});

	let dialog: DialogWithConfirm;

	let old_state = $state<GameRole | null>(null);

	let props: {
		guildId: string;
		games: {
			name: string;
			icon: string | null;
		}[];
		roles: {
			id: string;
			name: string;
		}[];
	} = $props();

	export function open(game?: GameRole) {
		if (game) {
			old_state = game;
			reset(form, {
				initialInput: {
					roleId: game.roleId,
					gameName: game.gameName,
				},
			});
		} else {
			old_state = null;
			reset(form, {
				initialInput: {
					roleId: '',
					gameName: '',
				},
			});
		}
		dialog.open();
	}

	const handleSubmit: SubmitEventHandler<typeof GameRole_Schema> = async (output) => {
		const submission_id = crypto.randomUUID();
		try {
			let submit_promise: Promise<void>;

			const old_object_copy = old_state ? { ...old_state } : null;

			if (old_object_copy) {
				submit_promise = updateGameRole({
					old: {
						gameName: old_object_copy.gameName,
						roleId: old_object_copy.roleId,
						guildId: props.guildId,
					},
					roleId: output.roleId,
					gameName: output.gameName,
				}).updates(getGameRoles(props.guildId));
			} else {
				submit_promise = addGameRole({
					guildId: props.guildId,
					roleId: output.roleId,
					gameName: output.gameName,
				}).updates(getGameRoles(props.guildId));
			}

			toast.promise(submit_promise, {
				id: submission_id,
				loading: old_state ? 'Updating game role...' : 'Adding game role...',
				success: old_state ? 'Game role updated successfully' : 'Game role added successfully',
				error: (error) => (isHttpError(error) ? error.body.message : 'Unknown error'),
			});

			await submit_promise;

			dialog.close();
		} catch (error) {
			toast.error(old_state ? 'Failed to update game role' : 'Failed to add game role', {
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
				throw new Error('No game role to delete');
			}

			let delete_promise = removeGameRole({
				roleId: old_object_copy.roleId,
				guildId: props.guildId,
			}).updates(
				getGameRoles(props.guildId).withOverride((arr) =>
					arr?.filter((g) => g.roleId !== old_object_copy.roleId)
				)
			);

			toast.promise(delete_promise, {
				id: deletion_id,
				loading: 'Deleting game role...',
				success: 'Game role deleted successfully',
				error: (error) => (isHttpError(error) ? error.body.message : 'Unknown error'),
			});

			await delete_promise;

			dialog.close();
		} catch (error) {
			toast.error('Failed to delete game role', {
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
				roleId: '',
				gameName: '',
			},
		});
		old_state = null;
	}}
	confirmTitle="Confirm Delete"
	onconfirm={handle_delete}
>
	<Dialog.Header>
		<Dialog.Title>
			{#if old_state}Edit Game Role{:else}Add Game Role{/if}
		</Dialog.Title>
		<Dialog.Description>
			{#if old_state}{props.roles.find((r) => r.id === old_state?.roleId)?.name ||
					old_state?.roleId}{/if}
		</Dialog.Description>
	</Dialog.Header>

	<Form of={form} onsubmit={handleSubmit}>
		<Field.Set>
			<Field.Group>
				<SField of={form} path={['gameName']}>
					{#snippet children(field)}
						<Field.Field data-invalid={field.errors ? 'true' : undefined}>
							<Field.Label><Gamepad2 size={16} />Game Name</Field.Label>
							<Select.Root
								type="single"
								{...field.props}
								value={field.input}
								onValueChange={(v) => field.onInput(v)}
							>
								<Select.Trigger>
									{#if field.input}
										{field.input}
									{:else}
										Select a game
									{/if}
								</Select.Trigger>
								<Select.Content>
									{#each props.games as game (game.name)}
										<Select.Item value={game.name}>{game.name}</Select.Item>
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

				<SField of={form} path={['roleId']}>
					{#snippet children(field)}
						<Field.Field data-invalid={field.errors ? 'true' : undefined}>
							<Field.Label><Shield size={16} />Discord Role</Field.Label>
							<Select.Root
								type="single"
								{...field.props}
								value={field.input}
								onValueChange={(v) => field.onInput(v)}
							>
								<Select.Trigger>
									{#if field.input}
										{props.roles.find((r) => r.id === field.input)?.name ?? field.input}
									{:else}
										Select a role
									{/if}
								</Select.Trigger>
								<Select.Content>
									{#each props.roles as role (role.id)}
										<Select.Item value={role.id}>{role.name}</Select.Item>
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
			</Field.Group>
		</Field.Set>
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
		Are you sure you want to delete the game role for <strong class="text-base-content">
			{old_state?.gameName}
		</strong>
		?
	{/snippet}
</DialogWithConfirm>
