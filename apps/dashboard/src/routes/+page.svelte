<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageProps } from './$types';
	import { getEventGames } from '$lib/eventGame.remote';
	import { authClient } from '$lib/auth.client';
	import EventGameDialog from '$lib/components/EventGameDialog.svelte';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Gamepad2 from '@lucide/svelte/icons/gamepad-2';
	import Clock from '@lucide/svelte/icons/clock';
	import Plus from '@lucide/svelte/icons/plus';
	import Image from '@lucide/svelte/icons/image';
	import AlertCircle from '@lucide/svelte/icons/alert-circle';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Users from '@lucide/svelte/icons/users';
	import { resolve } from '$app/paths';

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

	let countdown_now = $state(Date.now());
	let countdown_interval: ReturnType<typeof setInterval> | undefined = $state();

	function start_countdown_timer() {
		countdown_now = Date.now();
		countdown_interval = setInterval(() => {
			countdown_now = Date.now();
		}, 1000);
	}

	function stop_countdown_timer() {
		if (countdown_interval) {
			clearInterval(countdown_interval);
			countdown_interval = undefined;
		}
	}

	$effect(() => {
		start_countdown_timer();
		return () => stop_countdown_timer();
	});

	type CountdownResult = { h: number; m: number; s: number };

	function format_countdown(target_time: Date): CountdownResult | 'now' | null {
		const diff = target_time.getTime() - countdown_now;
		if (diff <= -5000) return null;
		else if (diff <= 0) return 'now';

		const h = Math.floor(diff / 3_600_000);
		const m = Math.floor((diff % 3_600_000) / 60_000);
		const s = Math.floor((diff % 60_000) / 1_000);

		return { h, m, s };
	}
</script>

<div class="min-h-screen bg-linear-to-br from-base-300/20 via-base-200/30 to-base-100">
	<div class="container mx-auto max-w-7xl px-4 py-8">
		{#if data.servers}
			<section class="animate-in fade-in slide-in-from-bottom-4 mb-12 duration-500">
				<div class="mb-6 flex items-center justify-between">
					<div class="flex items-center gap-3">
						<div class="rounded-xl bg-linear-to-br from-primary/20 to-secondary/20 p-2.5">
							<Users size={24} class="text-primary" />
						</div>
						<div>
							<h2 class="text-2xl font-bold text-base-content">Your Servers</h2>
							<p class="text-sm text-base-content/60">
								{data.servers.length} server{data.servers.length !== 1 ? 's' : ''} connected
							</p>
						</div>
					</div>
				</div>
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
					{#each data.servers as server (server.id)}
						<button
							class="group relative w-full overflow-hidden rounded-2xl border border-base-300/50 bg-base-100 text-left shadow-md transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl"
							onclick={() => goto(resolve(`/server/${server.id}`))}
						>
							<div
								class="absolute inset-0 bg-linear-to-br from-primary/5 to-secondary/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
							></div>
							<div class="relative card-body p-5">
								<div class="flex items-center gap-4">
									<div class="avatar">
										<div
											class="mask w-14 rounded-xl mask-squircle shadow-sm ring-2 ring-primary/20 transition-all duration-300 group-hover:ring-primary/50"
										>
											<img src={server.icon} alt="" loading="lazy" />
										</div>
									</div>
									<div class="min-w-0 flex-1">
										<h3
											class="truncate text-lg font-bold transition-colors group-hover:text-primary"
										>
											{server.name}
										</h3>
										<p class="mt-0.5 flex items-center gap-1 text-xs text-base-content/50">
											<ChevronRight size={12} />
											Click to manage
										</p>
									</div>
									<ChevronRight
										size={18}
										class="text-base-content/30 transition-all duration-300 group-hover:translate-x-1 group-hover:text-primary"
									/>
								</div>
							</div>
						</button>
					{/each}
				</div>
			</section>
		{/if}

		<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
			{#if canListGames && query}
				<section
					class="animate-in fade-in slide-in-from-bottom-4 card border border-base-300/50 bg-base-100 shadow-lg delay-100 duration-500"
				>
					<div class="card-body pb-5">
						<div class="mb-2 flex items-center justify-between">
							<div class="flex items-center gap-3">
								<div class="rounded-xl bg-linear-to-br from-primary/20 to-secondary/20 p-2">
									<Gamepad2 size={22} class="text-primary" />
								</div>
								<div>
									<h2 class="card-title text-xl">Event Games</h2>
									<p class="text-xs text-base-content/50">
										{#if query.loading}Loading...{:else if query.current}{query.current.length} game{query
												.current.length !== 1
												? 's'
												: ''}{:else}0 games{/if}
									</p>
								</div>
							</div>
							{#if canManageGames}
								<button
									class="btn gap-2 rounded-lg shadow-md transition-all btn-sm btn-primary hover:shadow-lg"
									onclick={() => eventGameDialog?.open()}
								>
									<Plus size={16} />
									Add Game
								</button>
							{/if}
						</div>
						<div class="mb-3 h-px bg-linear-to-r from-primary/20 to-transparent"></div>
						{#if query.error}
							<div class="alert rounded-xl alert-error">
								<AlertCircle size={20} />
								<span>Failed to load event games</span>
							</div>
						{:else if query.loading}
							<div class="flex flex-col gap-3 py-8">
								<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
								{#each Array(3) as _, i (i)}
									<div class="flex animate-pulse items-center gap-4 rounded-xl bg-base-200/50 p-3">
										<div class="h-10 w-10 rounded-lg bg-base-300"></div>
										<div class="h-4 w-24 rounded bg-base-300"></div>
									</div>
								{/each}
							</div>
						{:else if query.current?.length === 0}
							<div class="py-10 text-center text-base-content/60">
								<div class="mb-4 inline-flex rounded-full bg-base-200/50 p-4">
									<Gamepad2 size={40} class="opacity-40" />
								</div>
								<p class="text-base font-medium">No event games added yet</p>
								{#if canManageGames}
									<p class="mt-1.5 text-sm">Click "Add Game" to get started</p>
								{/if}
							</div>
						{:else}
							<div class="flex max-h-[400px] flex-col gap-2 overflow-y-auto pr-1">
								{#each query.current as game (game.name)}
									{@const emoji = game.icon
										? data.emojis.find((e) => e.id === game.icon)
										: undefined}
									<div
										class="flex items-center justify-between gap-4 rounded-xl bg-base-200/40 p-3.5 transition-all hover:bg-base-200/70"
									>
										<div class="flex items-center gap-3.5">
											{#if emoji}
												<div class="avatar">
													<div class="h-10 w-10 rounded-lg shadow-sm">
														<img
															src={`https://cdn.discordapp.com/emojis/${emoji.id}.webp?size=96&quality=lossless${emoji.animated ? '&animated=true' : ''}`}
															alt=""
															loading="lazy"
														/>
													</div>
												</div>
											{:else}
												<div
													class="flex h-10 w-10 items-center justify-center rounded-lg bg-base-300/50 text-base-content/40"
												>
													<Image size={20} />
												</div>
											{/if}
											<span class="font-semibold">{game.name}</span>
										</div>
										{#if canManageGames}
											<button
												class="btn btn-square rounded-lg text-base-content/50 btn-ghost transition-all btn-sm hover:bg-primary/10 hover:text-primary"
												onclick={() => eventGameDialog?.open(game)}
											>
												<Pencil size={16} />
											</button>
										{/if}
									</div>
								{/each}
							</div>
						{/if}
					</div>
				</section>
			{/if}

			<section
				class="animate-in fade-in slide-in-from-bottom-4 card border border-base-300/50 bg-base-100 shadow-lg delay-200 duration-500"
			>
				<div class="card-body pb-5">
					<div class="mb-2 flex items-center justify-between">
						<div class="flex items-center gap-3">
							<div class="rounded-xl bg-linear-to-br from-secondary/20 to-primary/20 p-2">
								<Clock size={22} class="text-secondary" />
							</div>
							<div>
								<h2 class="card-title text-xl">Upcoming Customs</h2>
								<p class="text-xs text-base-content/50">
									{#if data.customs}{data.customs.length} scheduled{:else}None scheduled{/if}
								</p>
							</div>
						</div>
					</div>
					<div class="mb-3 h-px bg-linear-to-r from-secondary/20 to-transparent"></div>
					{#if !data.customs || data.customs.length === 0}
						<div class="py-10 text-center text-base-content/60">
							<div class="mx-auto mb-4 inline-flex rounded-full bg-base-200/50 p-4">
								<Clock size={40} class="opacity-40" />
							</div>
							<p class="text-base font-medium">No upcoming customs scheduled</p>
						</div>
					{:else}
						<div class="flex max-h-[400px] flex-col gap-2 overflow-y-auto pr-1">
							{#each data.customs as custom (custom.id)}
								{@const timer = format_countdown(custom.scheduledTime)}
								{@const server = data.servers?.find((s) => s.id === custom.guildId)}
								{#if timer !== null}
									<div
										class="flex items-center justify-between gap-4 rounded-xl bg-base-200/40 p-3.5 transition-all hover:bg-base-200/70"
									>
										<div class="flex min-w-0 flex-1 items-center gap-3.5">
											{#if server?.icon}
												<div class="avatar shrink-0">
													<div class="h-10 w-10 rounded-full shadow-sm ring-2 ring-base-300/50">
														<img src={server.icon} alt="" loading="lazy" />
													</div>
												</div>
											{/if}
											<div class="flex min-w-0 flex-col">
												<span class="truncate font-semibold">{server?.name || custom.guildId}</span>
												<span class="text-sm text-base-content/60">{custom.gameName}</span>
											</div>
										</div>
										<div
											class="tooltip tooltip-left shrink-0"
											data-tip={custom.scheduledTime.toLocaleString()}
										>
											{#if timer === 'now'}
												<div class="flex items-center gap-1.5">
													<span class="loading loading-xs loading-spinner text-error"></span>
													<span class="text-sm font-semibold text-error">Starting</span>
												</div>
											{:else if timer}
												<div class="flex items-center gap-1">
													<div class="rounded-md border border-primary/20 bg-primary/10 px-2 py-1">
														<span class="font-mono text-xs font-bold text-primary">
															{timer.h.toString().padStart(2, '0')}
														</span>
													</div>
													<span class="text-xs text-base-content/40">:</span>
													<div class="rounded-md border border-primary/20 bg-primary/10 px-2 py-1">
														<span class="font-mono text-xs font-bold text-primary">
															{timer.m.toString().padStart(2, '0')}
														</span>
													</div>
													<span class="text-xs text-base-content/40">:</span>
													<div class="rounded-md border border-primary/20 bg-primary/10 px-2 py-1">
														<span class="font-mono text-xs font-bold text-primary">
															{timer.s.toString().padStart(2, '0')}
														</span>
													</div>
												</div>
											{/if}
										</div>
									</div>
								{/if}
							{/each}
						</div>
					{/if}
				</div>
			</section>
		</div>
	</div>
</div>

{#if canManageGames}
	<EventGameDialog bind:this={eventGameDialog} />
{/if}
