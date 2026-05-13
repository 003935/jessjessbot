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
	import Trash2 from '@lucide/svelte/icons/trash-2';

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
			let submit_promise: Promise<Promise<void>>;

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
	{#snippet confirmMessage()}
		Are you sure you want to delete the game role for <strong class="text-base-content">
			{old_state?.gameName}
		</strong>
		?
	{/snippet}
	{#snippet icon()}
		<Shield size={24} class="text-primary" />
	{/snippet}
	{#snippet title()}
		{#if old_state}Edit Game Role{:else}Add Game Role{/if}
	{/snippet}
	{#snippet subtitle()}
		{#if old_state}{props.roles.find((r) => r.id === old_state?.roleId)?.name ||
				old_state?.roleId}{/if}
	{/snippet}

	<Form of={form} onsubmit={handleSubmit}>
		<Field of={form} path={['gameName']}>
			{#snippet children(field)}
				<fieldset class="fieldset rounded-xl">
					<legend class="fieldset-legend flex items-center gap-2 text-sm font-semibold">
						<Gamepad2 size={16} class="text-base-content/60" />
						Game Name
					</legend>
					<select
						class="select-bordered select w-full rounded-xl bg-base-200"
						{...field.props}
						value={field.input}
					>
						<option value="">Select a game</option>
						{#each props.games as game (game.name)}
							<option value={game.name}>{game.name}</option>
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

		<Field of={form} path={['roleId']}>
			{#snippet children(field)}
				<fieldset class="fieldset rounded-xl">
					<legend class="fieldset-legend flex items-center gap-2 text-sm font-semibold">
						<Shield size={16} class="text-base-content/60" />
						Discord Role
					</legend>
					<select
						class="select-bordered select w-full rounded-xl bg-base-200"
						{...field.props}
						value={field.input}
					>
						<option value="">Select a role</option>
						{#each props.roles as role (role.id)}
							<option value={role.id}>{role.name}</option>
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
