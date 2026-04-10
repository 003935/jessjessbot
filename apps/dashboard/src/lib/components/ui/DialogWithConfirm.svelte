<script lang="ts">
	import type { Snippet } from 'svelte';
	import { slide } from 'svelte/transition';
	import Dialog from './Dialog.svelte';
	import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
	import Trash2 from '@lucide/svelte/icons/trash-2';

	let dialog: Dialog;
	let show_confirm = $state(false);
	let is_confirming = $state(false);

	export function open() {
		show_confirm = false;
		is_confirming = false;
		dialog.open();
	}

	export function close() {
		show_confirm = false;
		is_confirming = false;
		dialog.close();
	}

	export function openConfirm() {
		show_confirm = true;
		is_confirming = false;
		dialog.open();
	}

	let {
		children,
		icon: icon_snippet,
		title: title_snippet,
		subtitle: subtitle_snippet,
		actions: actions_snippet,
		onclose,
		confirmTitle,
		confirmMessage,
		confirmLabel = 'Delete',
		onconfirm,
	}: {
		icon: Snippet<[]>;
		title: Snippet<[]>;
		subtitle?: Snippet<[]>;
		children: Snippet<[]>;
		actions: Snippet<[]>;
		onclose?: () => void;
		confirmTitle: string;
		confirmMessage: Snippet<[]>;
		confirmLabel?: string;
		onconfirm: () => Promise<void>;
	} = $props();

	async function handle_confirm() {
		is_confirming = true;
		try {
			await onconfirm();
			show_confirm = false;
		} catch (error) {
			show_confirm = false;
			throw error;
		} finally {
			is_confirming = false;
		}
	}

	function handle_cancel_confirm() {
		show_confirm = false;
	}

	function handle_dialog_close() {
		show_confirm = false;
		is_confirming = false;
		onclose?.();
	}
</script>

<Dialog bind:this={dialog} onclose={handle_dialog_close}>
	{#snippet icon()}
		{#if show_confirm}
			<AlertTriangle size={24} class="text-error" />
		{:else}
			{@render icon_snippet()}
		{/if}
	{/snippet}
	{#snippet title()}
		{#if show_confirm}{confirmTitle}{:else}{@render title_snippet()}{/if}
	{/snippet}
	{#snippet subtitle()}
		{#if show_confirm}
			<span class="text-error">This action cannot be undone</span>
		{:else if subtitle_snippet}
			{@render subtitle_snippet()}
		{/if}
	{/snippet}

	{#if show_confirm}
		<div class="flex flex-col items-center gap-4 py-4" transition:slide={{ duration: 200 }}>
			<div class="rounded-full bg-error/10 p-3">
				<AlertTriangle size={32} class="text-error" />
			</div>
			<p class="text-center text-sm text-base-content/70">{@render confirmMessage()}</p>
		</div>
	{:else}
		<div transition:slide={{ duration: 200 }}>
			{@render children()}
		</div>
	{/if}

	{#snippet actions()}
		{#if show_confirm}
			<button class="btn rounded-lg btn-error" onclick={handle_confirm} disabled={is_confirming}>
				{#if is_confirming}
					<span class="loading loading-xs loading-spinner"></span>
				{:else}
					<Trash2 size={16} />
				{/if}
				{confirmLabel}
			</button>
			<button
				class="btn rounded-lg btn-ghost"
				onclick={handle_cancel_confirm}
				disabled={is_confirming}
			>
				Cancel
			</button>
		{:else}
			{@render actions_snippet()}
		{/if}
	{/snippet}
</Dialog>
