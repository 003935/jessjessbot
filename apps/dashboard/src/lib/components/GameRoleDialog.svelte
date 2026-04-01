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
	import Dialog from './ui/Dialog.svelte';
	import {
		createForm,
		Field,
		Form,
		reset,
		submit,
		type SubmitEventHandler,
	} from '@formisch/svelte';
	import { isHttpError } from '@sveltejs/kit';
	import { addGameRole, getGameRoles, removeGameRole, updateGameRole } from '$lib/gameRole.remote';
	import Shield from '@lucide/svelte/icons/shield';
	import Gamepad2 from '@lucide/svelte/icons/gamepad-2';
	import AlertCircle from '@lucide/svelte/icons/alert-circle';

	const form = createForm({
		schema: GameRole_Schema,
		initialInput: {
			roleId: '',
			gameName: '',
		},
	});

	let dialog: Dialog;

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
		}
		dialog.open();
	}

	const handleSubmit: SubmitEventHandler<typeof GameRole_Schema> = async (output, _event) => {
		const submission_id = crypto.randomUUID();
		try {
			let submitPromise: Promise<void>;

			const old_object_copy = old_state ? { ...old_state } : null;

			if (old_object_copy) {
				submitPromise = updateGameRole({
					old: {
						gameName: old_object_copy.gameName,
						roleId: old_object_copy.roleId,
						guildId: props.guildId,
					},
					roleId: output.roleId,
					gameName: output.gameName,
				}).updates(getGameRoles(props.guildId));
			} else {
				submitPromise = addGameRole({
					guildId: props.guildId,
					roleId: output.roleId,
					gameName: output.gameName,
				}).updates(getGameRoles(props.guildId));
			}

			toast.promise(new Promise((r) => setTimeout(r, 10000)), {
				id: submission_id,
				loading: old_state ? 'Updating game role...' : 'Adding game role...',
			});

			await submitPromise;

			toast.success(old_state ? 'Game role updated successfully' : 'Game role added successfully', {
				id: submission_id,
			});

			dialog.close();
		} catch (error) {
			toast.error(old_state ? 'Failed to update game role' : 'Failed to add game role', {
				id: submission_id,
				description: isHttpError(error) ? error.body.message : 'Unknown Error',
			});
		}
	};

	async function handleDelete() {
		const deletion_id = crypto.randomUUID();
		try {
			const old_object_copy = old_state ? { ...old_state } : null;

			if (!old_object_copy) {
				throw new Error('No game role to delete');
			}

			let deletePromise = removeGameRole({
				roleId: old_object_copy.roleId,
				guildId: props.guildId,
			}).updates(
				getGameRoles(props.guildId).withOverride((arr) =>
					arr?.filter((g) => g.roleId !== old_object_copy.roleId)
				)
			);

			toast.promise(new Promise((r) => setTimeout(r, 10000)), {
				id: deletion_id,
				loading: 'Deleting game role...',
			});

			await deletePromise;

			toast.success('Game role deleted successfully', {
				id: deletion_id,
				action: {
					label: 'Undo',
					onClick: () => {
						addGameRole({
							guildId: props.guildId,
							roleId: old_object_copy.roleId,
							gameName: old_object_copy.gameName,
						}).updates(getGameRoles(props.guildId));
					},
				},
			});

			dialog.close();
		} catch (error) {
			toast.error('Failed to delete game role', {
				id: deletion_id,
				description: isHttpError(error) ? error.body.message : 'Unknown Error',
			});
		}
	}
</script>

<Dialog
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
>
	{#snippet icon()}
		<Shield size={24} class="text-primary" />
	{/snippet}
	{#snippet title()}
		{#if old_state}Edit Game Role{:else}Add Game Role{/if}
	{/snippet}
	{#snippet subtitle()}
		{#if old_state}{old_state?.roleId}{/if}
	{/snippet}
	<Form of={form} onsubmit={handleSubmit}>
		<Field of={form} path={['gameName']}>
			{#snippet children(field)}
				<fieldset class="fieldset rounded-xl">
					<legend class="fieldset-legend flex items-center gap-2 text-sm font-semibold">
						<Gamepad2 size={16} class="text-base-content/60" />
						Game Name
					</legend>
					<select class="select select-bordered w-full bg-base-200 rounded-xl" {...field.props} value={field.input}>
						<option value="">Select a game</option>
						{#each props.games as game (game.name)}
							<option value={game.name}>{game.name}</option>
						{/each}
					</select>
					{#if field.errors}
						<div class="text-error text-sm mt-1 flex items-center gap-1">
							<AlertCircle size={16} />
							{field.errors[0]}
						</div>
					{/if}
				</fieldset>
			{/snippet}
		</Field>

		<Field of={form} path={['roleId']}>
			{#snippet children(field)}
				<fieldset class="fieldset rounded-xl">
					<legend class="fieldset-legend flex items-center gap-2 text-sm font-semibold">
						<Shield size={16} class="text-base-content/60" />
						Discord Role
					</legend>
					<select class="select select-bordered w-full bg-base-200 rounded-xl" {...field.props} value={field.input}>
						<option value="">Select a role</option>
						{#each props.roles as role (role.id)}
							<option value={role.id}>{role.name}</option>
						{/each}
					</select>
					{#if field.errors}
						<div class="text-error text-sm mt-1 flex items-center gap-1">
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
				class="btn mr-auto btn-error rounded-xl"
				disabled={form.isSubmitting}
				onclick={() => handleDelete()}
			>
				Delete
			</button>
		{/if}
		<button
			class="btn btn-primary rounded-xl"
			disabled={form.isSubmitting || (old_state && !form.isDirty)}
			onclick={() => submit(form)}
		>
			{#if form.isSubmitting}
				<span class="loading loading-spinner"></span>
				Saving...
			{:else}
				Save
			{/if}
		</button>
		<button class="btn btn-neutral rounded-xl" disabled={form.isSubmitting} onclick={() => dialog.close()}>
			Cancel
		</button>
	{/snippet}
</Dialog>
