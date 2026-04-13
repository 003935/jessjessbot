<script lang="ts">
	import type { Snippet } from 'svelte';
	import { slide } from 'svelte/transition';

	let dialog_element: HTMLDialogElement;

	export function open() {
		dialog_element.showModal();
	}

	export function close() {
		dialog_element.close();
	}

	let {
		children,
		icon,
		title,
		subtitle,
		actions,
		onclose,
	}: {
		icon: Snippet<[]>;
		title: Snippet<[]>;
		subtitle?: Snippet<[]>;
		children: Snippet<[]>;
		actions: Snippet<[]>;
		onclose?: () => void;
	} = $props();

	function handle_close() {
		if (onclose) setTimeout(onclose, 300);
	}
</script>

<dialog
	bind:this={dialog_element}
	onclose={handle_close}
	onclick={(e) => {
		if (e.target === dialog_element) {
			handle_close();
		}
	}}
	class="modal"
>
	<div
		class="modal-box w-full max-w-md rounded-2xl border border-base-300/50 bg-base-100 shadow-2xl"
		transition:slide={{ duration: 200 }}
	>
		<form method="dialog">
			<button
				class="btn absolute top-2.5 right-2.5 z-10 btn-circle text-base-content/50 btn-ghost transition-all btn-sm hover:bg-base-200 hover:text-base-content"
				aria-label="Close dialog"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="18"
					height="18"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M18 6 6 18" />
					<path d="m6 6 12 12" />
				</svg>
			</button>
		</form>
		<div class="mb-5 flex items-center gap-3 pr-6">
			<div class="flex-shrink-0 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 p-2">
				{@render icon()}
			</div>
			<div class="flex min-w-0 flex-col">
				<h3
					class="truncate bg-linear-to-r from-primary to-secondary bg-clip-text text-xl font-bold text-transparent"
				>
					{@render title()}
				</h3>
				{#if subtitle}
					<span class="mt-0.5 truncate text-sm text-base-content/60">
						{@render subtitle()}
					</span>
				{/if}
			</div>
		</div>
		<div class="space-y-4">
			{@render children()}
		</div>
		<div class="modal-action mt-6 gap-2">
			{@render actions()}
		</div>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>close</button>
	</form>
</dialog>
