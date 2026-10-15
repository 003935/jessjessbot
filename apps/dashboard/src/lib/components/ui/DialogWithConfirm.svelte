<script lang="ts">
	import type { Snippet } from 'svelte';
	import { slide } from 'svelte/transition';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';

	let is_open = $state(false);
	let is_confirming = $state(false);
	let confirmed = $state<undefined | boolean>(undefined);

	function reset() {
		is_confirming = false;
		is_open = false;
		confirmed = undefined;
	}

	export function open() {
		is_open = true;
	}

	export function close() {
		is_open = false;
	}

	export function openConfirm() {
		is_confirming = true;
	}

	let {
		children,
		onclose,
		confirmTitle,
		confirmMessage,
		confirmLabel = 'Delete',
		onconfirm,
	}: {
		children: Snippet<[]>;
		onclose?: () => void;
		confirmTitle: string;
		confirmMessage: Snippet<[]>;
		confirmLabel?: string;
		onconfirm: () => Promise<void>;
	} = $props();

	function handle_dialog_close() {
		reset();
		onclose?.();
	}

	async function handle_confirm() {
		await onconfirm();
	}
</script>

<Dialog.Root
	open={is_open}
	onOpenChangeComplete={(open) => open === false && handle_dialog_close()}
>
	<Dialog.Content>
		{@render children()}
	</Dialog.Content>
</Dialog.Root>

<AlertDialog.Root
	open={is_confirming}
	onOpenChangeComplete={(open) => open === false && confirmed === true && handle_confirm()}
>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>{confirmTitle}</AlertDialog.Title>
			<AlertDialog.Description>
				{@render confirmMessage()}
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel
				onclick={() => {
					confirmed = false;
					is_confirming = false;
				}}
			>
				Cancel
			</AlertDialog.Cancel>
			<AlertDialog.Action
				onclick={() => {
					confirmed = true;
					is_confirming = false;
				}}
			>
				{confirmLabel}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
