<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageProps } from './$types';
	import { getEventGames } from '$lib/eventGame.remote';
	import { authClient } from '$lib/auth.client';
	import EventGameDialog from '$lib/components/EventGameDialog.svelte';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import { onDestroy, onMount } from 'svelte';
	import Gamepad2 from '@lucide/svelte/icons/gamepad-2';
	import Clock from '@lucide/svelte/icons/clock';
	import Plus from '@lucide/svelte/icons/plus';
	import Image from '@lucide/svelte/icons/image';
	import AlertCircle from '@lucide/svelte/icons/alert-circle';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Trophy from '@lucide/svelte/icons/trophy';
	import Users from '@lucide/svelte/icons/users';

	let { data }: PageProps = $props();

	const canListGames = $derived(
		data.user === null
			? false
			: authClient.admin.checkRolePermission({
					permissions: {
						game: ['list'],
					},
					role: data.user.role,
				})
	);

	const canManageGames = $derived(
		data.user === null
			? false
			: authClient.admin.checkRolePermission({
					permissions: {
						game: ['manage'],
					},
					role: data.user.role,
				})
	);

	let eventGameDialog: EventGameDialog | undefined = $state();

	const query = $derived(canListGames ? getEventGames() : null);

	let now = $state(Date.now());

	let interval = $state<ReturnType<typeof setInterval>>();

	onMount(() => {
		interval = setInterval(() => {
			now = Date.now();
		}, 1000);
	});

	onDestroy(() => clearInterval(interval));

	function formatCountdown(targetTime: Date) {
		const diff = targetTime.getTime() - now;
		if (diff <= -5000) return null;
		else if (diff <= 0) return 'Now';

		const h = Math.floor(diff / 3_600_000);
		const m = Math.floor((diff % 3_600_000) / 60_000);
		const s = Math.floor((diff % 60_000) / 1_000);

		return [h, m, s];
	}
</script>

<div class="min-h-screen bg-gradient-to-br from-base-300/30 via-base-200/30 to-base-100">
	<div class="container mx-auto px-4 py-8">
		{#if data.servers}
			<div class="mb-10">
				<div class="flex items-center gap-3 mb-6">
					<div class="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20">
						<Users size={28} class="text-primary" />
					</div>
					<h2 class="text-2xl font-bold text-base-content">Your Servers</h2>
				</div>
				<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
					{#each data.servers as server (server.id)}
						<button
							class="group relative overflow-hidden rounded-2xl bg-base-100 border border-base-300 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 hover:border-primary/30"
							onclick={() => goto(`/server/${server.id}`)}
						>
							<div class="absolute inset-0 bg-gradient-to-br from-primary/5 to-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
							<div class="card-body p-5">
								<div class="flex items-center gap-4">
									<div class="avatar">
										<div class="mask w-14 rounded-xl mask-squircle ring-2 ring-primary/20 group-hover:ring-primary/40 transition-all duration-300 shadow-md">
											<img src={server.icon} alt="" />
										</div>
									</div>
									<div class="flex-1 text-left">
										<h3 class="font-bold text-lg truncate group-hover:text-primary transition-colors">
											{server.name}
										</h3>
										<p class="text-xs text-base-content/60">Click to manage</p>
									</div>
									<ChevronRight
										size={20}
										class="text-base-content/30 group-hover:text-primary group-hover:translate-x-1 transition-all"
									/>
								</div>
							</div>
						</button>
					{/each}
				</div>
			</div>
		{/if}

		<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
			{#if canListGames && query}
				<div class="card bg-base-100 shadow-xl border border-base-300">
					<div class="card-body pt-6">
						<div class="flex items-center justify-between mb-4">
							<div class="flex items-center gap-3">
								<div class="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20">
									<Gamepad2 size={24} class="text-primary" />
								</div>
								<h2 class="card-title text-2xl">Event Games</h2>
							</div>
							{#if canManageGames}
								<button
									class="btn btn-sm btn-primary gap-2 rounded-xl shadow-lg hover:shadow-xl transition-all"
									onclick={() => {
										eventGameDialog?.open();
									}}
								>
									<Plus size={18} />
									Add Game
								</button>
							{/if}
						</div>
						<div class="h-px bg-gradient-to-r from-primary/20 to-transparent mb-4"></div>
						{#if query.error}
							<div class="alert alert-error rounded-xl">
								<AlertCircle size={24} />
								<span>Failed to load event games</span>
							</div>
						{:else if query.loading}
							<div class="py-12 flex justify-center">
								<span class="loading loading-spinner loading-lg text-primary"></span>
							</div>
						{:else if query.current?.length === 0}
							<div class="text-center py-12 text-base-content/60">
								<div class="inline-flex p-4 rounded-full bg-base-200/50 mb-4">
									<Gamepad2 size={48} class="opacity-50" />
								</div>
								<p class="text-lg font-medium">No event games added yet</p>
								{#if canManageGames}
									<p class="text-sm mt-2">Click "Add Game" to get started</p>
								{/if}
							</div>
						{:else}
							<div class="flex flex-col gap-2">
								{#each query.current as game (game.name)}
									{@const emoji = game.icon
										? data.emojis.find((e) => e.id === game.icon)
										: undefined}
									<div
										class="flex items-center justify-between gap-4 rounded-xl bg-base-200/50 p-4 transition-all hover:bg-base-200"
									>
										<div class="flex items-center gap-4">
											<div class="flex items-center justify-center">
												{#if emoji}
													<div class="avatar">
														<div class="w-10 rounded-lg shadow-sm">
															<img
																src={`https://cdn.discordapp.com/emojis/${emoji.id}.webp?size=96&quality=lossless${emoji.animated ? '&animated=true' : ''}`}
																alt=""
															/>
														</div>
													</div>
												{:else}
													<div
														class="w-10 h-10 rounded-lg bg-base-300 flex items-center justify-center text-base-content/40"
													>
														<Image size={24} />
													</div>
												{/if}
											</div>
											<span class="font-semibold">{game.name}</span>
										</div>
										{#if canManageGames}
											<button
												class="btn btn-ghost btn-sm btn-square text-base-content/60 hover:text-primary hover:bg-primary/10 transition-all rounded-lg"
												onclick={() => {
													eventGameDialog?.open(game);
												}}
											>
												<PencilIcon size={18} />
											</button>
										{/if}
									</div>
								{/each}
							</div>
						{/if}
					</div>
				</div>
			{/if}

			<div class="card bg-base-100 shadow-xl border border-base-300">
				<div class="card-body pt-6">
					<div class="flex items-center justify-between mb-4">
						<div class="flex items-center gap-3">
							<div class="p-2 rounded-xl bg-gradient-to-br from-secondary/20 to-primary/20">
								<Clock size={24} class="text-secondary" />
							</div>
							<h2 class="card-title text-2xl">Upcoming Customs</h2>
						</div>
					</div>
					<div class="h-px bg-gradient-to-r from-secondary/20 to-transparent mb-4"></div>
					{#if !data.customs || data.customs.length === 0}
						<div class="text-center py-12 text-base-content/60">
							<div class="inline-flex p-4 rounded-full bg-base-200/50 mb-4 mx-auto">
								<Clock size={48} class="opacity-50" />
							</div>
							<p class="text-lg font-medium">No upcoming customs scheduled</p>
						</div>
					{:else}
						<div class="flex flex-col gap-2">
							{#each data.customs as custom (custom.id)}
								{@const timer = formatCountdown(custom.scheduledTime)}
								{@const server = data.servers.find((s) => s.id === custom.guildId)}
								{#if timer !== null}
									<div
										class="flex items-center justify-between gap-4 rounded-xl bg-base-200/50 p-4 transition-all hover:bg-base-200"
									>
										<div class="flex items-center gap-4">
											{#if server?.icon}
												<div class="avatar">
													<div class="w-10 rounded-full ring-2 ring-base-300 shadow-sm">
														<img src={server.icon} alt="" />
													</div>
												</div>
											{/if}
											<div class="flex flex-col">
												<span class="font-semibold">{server?.name || custom.guildId}</span>
												<span class="text-sm text-base-content/60">{custom.gameName}</span>
											</div>
										</div>
										<div
											class="tooltip"
											data-tip={custom.scheduledTime.toLocaleString()}
											data-tip-position="top"
										>
											{#if timer instanceof Array}
												{@const [h, m, s] = timer}
												<div class="flex items-center gap-1.5">
													<div
														class="flex items-center gap-1 px-2 py-1 rounded-lg bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20"
													>
														<span class="text-xs font-mono font-bold text-primary"
															>{h.toString().padStart(2, '0')}</span
														>
														<span class="text-xs text-base-content/60">h</span>
													</div>
													<span class="text-base-content/40 text-sm">:</span>
													<div
														class="flex items-center gap-1 px-2 py-1 rounded-lg bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20"
													>
														<span class="text-xs font-mono font-bold text-primary"
															>{m.toString().padStart(2, '0')}</span
														>
														<span class="text-xs text-base-content/60">m</span>
													</div>
													<span class="text-base-content/40 text-sm">:</span>
													<div
														class="flex items-center gap-1 px-2 py-1 rounded-lg bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20"
													>
														<span class="text-xs font-mono font-bold text-primary"
															>{s.toString().padStart(2, '0')}</span
														>
														<span class="text-xs text-base-content/60">s</span>
													</div>
												</div>
											{:else if timer === 'Now'}
												<div class="flex items-center gap-2">
													<span class="loading loading-spinner loading-sm text-error"></span>
													<span class="text-error font-semibold text-sm">Starting Now</span>
												</div>
											{/if}
										</div>
									</div>
								{/if}
							{/each}
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>

{#if canManageGames}
	<EventGameDialog bind:this={eventGameDialog} />
{/if}
