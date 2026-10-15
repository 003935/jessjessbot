<script lang="ts">
	import * as Chart from '$lib/components/ui/chart/index.js';
	import { BarChart, Bar } from 'layerchart';
	import { scaleBand } from 'd3-scale';
	import { cubicInOut } from 'svelte/easing';

	let props: {
		data: { score: number; value: number }[];
		class?: string;
	} = $props();

	const scoreLabels: Record<
		number,
		{
			label: string;
			color: string;
		}
	> = {
		1: { label: '1/6', color: 'var(--chart-1)' },
		2: { label: '2/6', color: 'var(--chart-2)' },
		3: { label: '3/6', color: 'var(--chart-3)' },
		4: { label: '4/6', color: 'var(--chart-3)' },
		5: { label: '5/6', color: 'var(--chart-4)' },
		6: { label: '6/6', color: 'var(--chart-4)' },
		7: { label: 'DNF', color: 'var(--chart-5)' },
	};

	const chartData = $derived.by(() => {
		const ret = new Map<number, { value: number; color: string; label: string }>(
			Object.entries(scoreLabels).map(([score, { label, color }]) => [
				Number(score),
				{ value: 0, label, color },
			])
		);
		if (!props.data || props.data.length === 0) return Array.from(ret.values());
		for (const d of props.data) {
			const entry = ret.get(d.score);
			if (entry) {
				entry.value = d.value;
			}
		}
		return Array.from(ret.values());
	});

	const chartConfig = {
		value: { label: 'Count' },
		one: { label: '1/6', color: 'var(--chart-1)' },
		two: { label: '2/6', color: 'var(--chart-2)' },
		three: { label: '3/6', color: 'var(--chart-3)' },
		four: { label: '4/6', color: 'var(--chart-3)' },
		five: { label: '5/6', color: 'var(--chart-4)' },
		six: { label: '6/6', color: 'var(--chart-4)' },
		dnf: { label: 'DNF', color: 'var(--chart-5)' },
	} satisfies Chart.ChartConfig;
</script>

<Chart.Container config={chartConfig} class={props.class}>
	<BarChart
		data={chartData}
		x="label"
		y="value"
		xScale={scaleBand().padding(0.25)}
		axis="x"
		rule={false}
		props={{
			xAxis: {
				format: (d) => d,
			},
			highlight: { area: { fill: 'none' } },
		}}
	>
		{#snippet tooltip()}
			<Chart.Tooltip hideLabel nameKey="value" />
		{/snippet}
		{#snippet marks({ context })}
			{@const s = context.series.visibleSeries[0]}
			{#each chartData as data, i (i)}
				<Bar
					seriesKey={s.key}
					{...s.props}
					rounded="all"
					radius={5}
					motion={{ type: 'tween', duration: 500, easing: cubicInOut }}
					fill={data.color}
					{data}
					stroke="none"
				/>
			{/each}
		{/snippet}
	</BarChart>
</Chart.Container>
