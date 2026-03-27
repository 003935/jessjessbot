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
		title,
		actions,
		onclose,
	}: {
		title: Snippet<[]>;
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
	<div class="modal-box">
		<h3 class="text-lg font-bold">
			{@render title()}
		</h3>
		{@render children()}
		<div class="modal-action">
			{@render actions()}
		</div>
	</div>
</dialog>
