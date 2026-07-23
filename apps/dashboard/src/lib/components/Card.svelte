<script lang="ts">
	import { type LucideIcon } from '@lucide/svelte';
	import type { Snippet } from 'svelte';

	const {
		title,
		subtext,
		children,
		leftside,
		Icon,
	}: {
		Icon: LucideIcon;
		title: string;
		subtext?: string;
		children?: Snippet;
		leftside?: Snippet;
	} = $props();
</script>

<div class="card bg-base-100 shadow-lg">
	<div class="card-body p-0">
		<div class="flex items-center justify-between p-6 pb-3">
			<div class="flex items-center gap-3">
				<div class="rounded-xl bg-linear-to-br from-primary/20 to-secondary/20 p-2">
					<Icon size={22} class="text-primary" />
				</div>
				<div>
					<h3 class="card-title text-xl">{title}</h3>
					{#if subtext}
						<p class="text-xs text-base-content/50">{subtext}</p>
					{/if}
				</div>
			</div>
			{#if leftside}
				{@render leftside()}
			{/if}
		</div>
		<div class="h-px bg-linear-to-r from-primary/20 to-primary/5"></div>
		<div class="overflow-y-auto p-6 pt-3">
			{#if children}
				{@render children()}
			{/if}
		</div>
	</div>
</div>
