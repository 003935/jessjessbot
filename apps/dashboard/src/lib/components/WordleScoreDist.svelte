<script lang="ts">
	import { getWordleStats } from '$lib/wordle.remote';
	import Trophy from '@lucide/svelte/icons/trophy';
	import { Bar } from 'svelte-chartjs';
	import {
		Chart as ChartJS,
		CategoryScale,
		LinearScale,
		BarElement,
		Title,
		Legend,
		Tooltip,
	} from 'chart.js';

	ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Legend, Tooltip);

	let { serverId }: { serverId: string } = $props();

	type ScoreDistribution = {
		score: number;
		count: number;
	};

	const query = $derived(getWordleStats(serverId));

	const scoreLabels: Record<number, string> = {
		1: '1/6',
		2: '2/6',
		3: '3/6',
		4: '4/6',
		5: '5/6',
		6: '6/6',
		7: 'DNF',
	};

	const allScores = [1, 2, 3, 4, 5, 6, 7];

	const chartData = $derived.by(() => {
		const data = query.current;
		if (!data || data.length === 0) return null;

		const map = new Map(data.map((d) => [d.score, d.count]));
		const counts = allScores.map((score) => map.get(score) || 0);

		const colors = [
			'rgba(16, 185, 129, 0.8)',
			'rgba(34, 197, 94, 0.8)',
			'rgba(234, 179, 8, 0.8)',
			'rgba(249, 115, 22, 0.8)',
			'rgba(239, 68, 68, 0.8)',
			'rgba(185, 28, 28, 0.8)',
			'rgba(75, 85, 99, 0.8)',
		];

		const borders = [
			'rgba(16, 185, 129, 1)',
			'rgba(34, 197, 94, 1)',
			'rgba(234, 179, 8, 1)',
			'rgba(249, 115, 22, 1)',
			'rgba(239, 68, 68, 1)',
			'rgba(185, 28, 28, 1)',
			'rgba(75, 85, 99, 1)',
		];

		return {
			labels: allScores.map((s) => scoreLabels[s]),
			datasets: [
				{
					label: 'Count',
					data: counts,
					backgroundColor: colors,
					borderColor: borders,
					borderWidth: 1,
					borderRadius: 6,
				},
			],
		};
	});

	const chartOptions = $derived({
		responsive: true,
		maintainAspectRatio: false,
		plugins: {
			legend: {
				display: false,
			},
			tooltip: {
				callbacks: {
					title: (items: { dataIndex: number }[]) => {
						const idx = items[0]?.dataIndex ?? 0;
						return `Score: ${scoreLabels[allScores[idx]]}`;
					},
					label: (context: { raw: unknown }) => `Count: ${context.raw}`,
				},
			},
		},
		scales: {
			x: {
				grid: {
					display: false,
				},
			},
			y: {
				beginAtZero: true,
				ticks: {
					stepSize: 1,
				},
			},
		},
	});

	const totalWins = $derived.by(() => {
		const data = query.current;
		if (!data || data.length === 0) return 0;
		return data.reduce((sum, d) => sum + d.count, 0);
	});
</script>

<section
	class="animate-in fade-in slide-in-from-bottom-4 card border border-base-300/50 bg-base-100 shadow-lg delay-200 duration-500"
>
	<div class="card-body">
		<div class="mb-2 flex items-center justify-between">
			<div class="flex items-center gap-3">
				<div class="rounded-xl bg-linear-to-br from-warning/20 to-secondary/20 p-2">
					<Trophy size={22} class="text-warning" />
				</div>
				<div>
					<h2 class="card-title text-xl">Score Distribution</h2>
					<p class="text-xs text-base-content/50">
						{#if query.loading}Loading...{:else if query.current}
							{totalWins} total results{:else}No data{/if}
					</p>
				</div>
			</div>
		</div>
		<div class="mb-3 h-px bg-linear-to-r from-warning/20 to-transparent"></div>

		{#if query.error}
			<div class="alert rounded-xl alert-error">
				<Trophy size={20} />
				<span>Failed to load wordle statistics</span>
			</div>
		{:else if query.loading}
			<div class="flex animate-pulse items-center justify-center py-10">
				<div class="h-64 w-full rounded bg-base-300"></div>
			</div>
		{:else if !chartData}
			<div class="py-10 text-center text-base-content/60">
				<div class="mx-auto mb-4 inline-flex rounded-full bg-base-200/50 p-4">
					<Trophy size={40} class="opacity-40" />
				</div>
				<p class="text-base font-medium">No wordle results recorded yet</p>
				<p class="mt-1.5 text-sm">Import wordle results to see statistics</p>
			</div>
		{:else}
			<div class="h-64">
				<Bar data={chartData} options={chartOptions} />
			</div>
		{/if}
	</div>
</section>
