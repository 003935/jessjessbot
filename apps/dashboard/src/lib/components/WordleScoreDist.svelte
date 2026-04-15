<script lang="ts">
	import { BarChart } from 'layerchart';

	let {
		data,
	}: {
		data: { score: number; value: number }[];
	} = $props();

	const scoreLabels: Record<
		number,
		{
			label: string;
			color: string;
		}
	> = {
		1: { label: '1/6', color: 'rgba(16, 185, 129, 0.8)' },
		2: { label: '2/6', color: 'rgba(34, 197, 94, 0.8)' },
		3: { label: '3/6', color: 'rgba(234, 179, 8, 0.8)' },
		4: { label: '4/6', color: 'rgba(249, 115, 22, 0.8)' },
		5: { label: '5/6', color: 'rgba(239, 68, 68, 0.8)' },
		6: { label: '6/6', color: 'rgba(185, 28, 28, 0.8)' },
		7: { label: 'DNF', color: 'rgba(75, 85, 99, 0.8)' },
	};

	const chartData = $derived.by(() => {
		const ret = new Map<string, { value: number; color: string; label: string }>(
			Object.entries(scoreLabels).map(([score, { label }]) => [
				score,
				{ value: 0, color: score, label },
			])
		);
		if (!data || data.length === 0) return Array.from(ret.values());
		for (const d of data) {
			const score = d.score.toString();
			const entry = ret.get(score);
			if (entry) {
				entry.value = d.value;
			}
		}
		return Array.from(ret.values());
	});
</script>

<BarChart
	data={chartData}
	x="label"
	y="value"
	c="color"
	cRange={Object.keys(scoreLabels).map((s) => `var(--score-${s})`)}
	--score-1={scoreLabels[1].color}
	--score-2={scoreLabels[2].color}
	--score-3={scoreLabels[3].color}
	--score-4={scoreLabels[4].color}
	--score-5={scoreLabels[5].color}
	--score-6={scoreLabels[6].color}
	--score-7={scoreLabels[7].color}
	props={{ bars: { width: 60 } }}
/>
