<script lang="ts">
	import { getGuildSummary } from '$lib/wordle.remote';
	import Users from '@lucide/svelte/icons/users';
	import Gamepad2 from '@lucide/svelte/icons/gamepad-2';
	import Trophy from '@lucide/svelte/icons/trophy';
	import Target from '@lucide/svelte/icons/target';
	import { type LucideIcon } from '@lucide/svelte';

	let { serverId }: { serverId: string } = $props();

	const query = $derived(getGuildSummary(serverId));

	type GuildSummary = NonNullable<typeof query.current>;
</script>

{#snippet statCard<T extends keyof GuildSummary>({
	icon,
	title,
	key,
	overrideValue,
}: {
	icon: {
		component: LucideIcon;
		classnames: string;
	};
	key: T;
	title: string;
	overrideValue?: (value: GuildSummary[T]) => string;
})}
	<div class={'rounded-xl bg-base-200/40 p-4'}>
		<div class="flex items-center gap-2">
			<div class={['rounded-lg p-1.5', icon.classnames]}>
				<icon.component size={18} />
			</div>
			<span class="text-xs text-base-content/60">{title}</span>
		</div>
		{#if query.loading}
			<div class="mt-2 h-8 w-16 skeleton"></div>
		{:else if query.current}
			<p class="mt-2 text-2xl font-bold">
				{overrideValue ? overrideValue(query.current[key]) : query.current[key]}
			</p>
		{/if}
	</div>
{/snippet}

<div class="grid grid-cols-2 gap-4 md:grid-cols-5">
	{@render statCard({
		icon: {
			component: Users,
			classnames: 'text-primary bg-primary/10',
		},
		title: 'Players',
		key: 'totalPlayers',
	})}

	{@render statCard({
		icon: {
			component: Gamepad2,
			classnames: 'text-secondary bg-secondary/10',
		},
		title: 'Games',
		key: 'totalGames',
	})}

	{@render statCard({
		icon: {
			component: Trophy,
			classnames: 'text-accent bg-accent/10',
		},
		title: 'Wins',
		key: 'totalWins',
	})}

	{@render statCard({
		icon: {
			component: Target,
			classnames: 'text-warning bg-warning/10',
		},
		title: 'Avg Score',
		key: 'avgScore',
		overrideValue: (v) => (v !== null ? v.toFixed(1) : 'N/A'),
	})}

	{@render statCard({
		icon: {
			component: Trophy,
			classnames: 'text-success bg-success/10',
		},
		title: 'Avg Win',
		key: 'avgWinningScore',
		overrideValue: (v) => (v !== null ? v.toFixed(1) : 'N/A'),
	})}
</div>
