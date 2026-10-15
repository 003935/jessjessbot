<script lang="ts" generics="T">
	import * as Card from '$lib/components/ui/card/index.js';
	import type { LucideIcon } from '@lucide/svelte';
	import type { RemoteQuery } from '@sveltejs/kit';
	import { onMount, type Snippet } from 'svelte';

	const props: {
		query?: RemoteQuery<T>;
		data?: T;
		icon?: {
			component: LucideIcon;
			class?: string;
		};
		class?: string;
		title: string;
		value: Snippet<[T]>;
	} = $props();

	onMount(() => {
		if (props.data === undefined && props.query === undefined)
			throw new Error('assign either data or query to the Stat Card');
	});
</script>

<Card.Root class={props.class}>
	<Card.Header>
		<Card.Title>{props.title}</Card.Title>
		{#if props.icon}
			<Card.Action>
				<props.icon.component size={18} class={props.icon.class} />
			</Card.Action>
		{/if}
	</Card.Header>
	<Card.Content class="text-2xl font-bold">
		{#if props.query}
			{#if props.query.loading}
				Loading...
			{:else if props.query.error}
				error...
			{:else if props.query.ready}
				{@render props.value(props.query.current)}
			{/if}
		{:else if props.data}
			{@render props.value(props.data)}
		{/if}
	</Card.Content>
</Card.Root>
