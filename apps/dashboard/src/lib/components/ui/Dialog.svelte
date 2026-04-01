<script lang="ts">
	import type { Snippet } from 'svelte';

	let dialog: HTMLDialogElement;

	export function open() {
		dialog.show();
	}

	export function close() {
		dialog.close();
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

	$effect(() => {
		const handleKeydown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				dialog.close();
			}
		};
		document.addEventListener('keydown', handleKeydown);
		return () => {
			document.removeEventListener('keydown', handleKeydown);
		};
	});
</script>

<dialog
	bind:this={dialog}
	onclose={() => {
		if (onclose) setTimeout(onclose, 300);
	}}
	class="modal"
>
	<div class="modal-box bg-base-100 shadow-2xl border border-base-300 rounded-2xl">
		<form method="dialog">
			<button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2 text-base-content/60 hover:text-base-content hover:bg-base-200 transition-all z-10">✕</button>
		</form>
		<div class="flex items-center gap-3 mb-4">
			<div class="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex-shrink-0">
				{@render icon()}
			</div>
			<div class="flex flex-col">
				<h3 class="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
					{@render title()}
				</h3>
				{#if subtitle}
					<span class="text-sm text-base-content/60 -mt-1">
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
