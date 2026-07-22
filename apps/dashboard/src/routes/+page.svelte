<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { authClient } from '$lib/auth.client';
	import EventGameDialog from '$lib/components/EventGameDialog.svelte';
	import * as Avatar from '$lib/components/ui/avatar/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Empty from '$lib/components/ui/empty/index.js';
	import { getEventGames } from '$lib/eventGame.remote';
	import AlertCircle from '@lucide/svelte/icons/alert-circle';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Clock from '@lucide/svelte/icons/clock';
	import Gamepad2 from '@lucide/svelte/icons/gamepad-2';
	import Image from '@lucide/svelte/icons/image';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Plus from '@lucide/svelte/icons/plus';
	import type { PageProps } from './$types';
	import { Bot, ImageOffIcon } from '@lucide/svelte';
	import NewEventDialog from '$lib/components/new-event-dialog.svelte';

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
	let newEventDialog: NewEventDialog | undefined = $state();

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

{#if data.user}
	<div class="container mx-auto grid h-fit max-w-7xl grid-cols-2 gap-4 px-4 py-8">
		{#if data.servers}
			<Card.Root class="col-span-2">
				<Card.Header>
					<Card.Title>Your Servers</Card.Title>
					<Card.Description>
						{data.servers.length} server{data.servers.length !== 1 ? 's' : ''} connected
					</Card.Description>
				</Card.Header>
				<Card.Content>
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
						{#each data.servers as server (server.id)}
							<Button
								onclick={() => goto(resolve(`/server/${server.id}`))}
								variant="outline"
								class="h-15.5 justify-between"
							>
								<div class="flex items-center gap-3 truncate text-lg">
									<img src={server.icon} alt={server.name} class="size-12 rounded-lg" />
									{server.name}
								</div>
								<ChevronRight
									size={18}
									class="text-base-content/30 transition-all duration-300 group-hover:translate-x-1 group-hover:text-primary"
								/>
							</Button>
						{/each}
					</div>
				</Card.Content>
			</Card.Root>
		{/if}

		{#if canListGames && query}
			<Card.Root>
				<Card.Header>
					<Card.Title>Event Games</Card.Title>
					<Card.Description>
						{#if query.loading}Loading...{:else if query.current}{query.current.length} game{query
								.current.length !== 1
								? 's'
								: ''}{:else}0 games{/if}
					</Card.Description>
					{#if canManageGames}
						<Card.Action>
							<Button onclick={() => eventGameDialog?.open()}>
								<Plus />Add
							</Button>
						</Card.Action>
					{/if}
				</Card.Header>
				<Card.Content class="flex h-64 overflow-auto">
					{#if query.error}
						<Empty.Root>
							<Empty.Header>
								<Empty.Media variant="icon">
									<AlertCircle class="opacity-40" />
								</Empty.Media>
								<Empty.Title>Error</Empty.Title>
								<Empty.Description>Failed to load event games</Empty.Description>
							</Empty.Header>
						</Empty.Root>
					{:else if query.loading}
						<div class="flex flex-col gap-3 py-8">
							<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
							{#each Array(3) as _, i (i)}
								<div class="bg-base-200/50 flex animate-pulse items-center gap-4 rounded-xl p-3">
									<div class="bg-base-300 h-10 w-10 rounded-lg"></div>
									<div class="bg-base-300 h-4 w-24 rounded"></div>
								</div>
							{/each}
						</div>
					{:else if query.current?.length === 0}
						<Empty.Root>
							<Empty.Header>
								<Empty.Media variant="icon">
									<Gamepad2 class="opacity-40" />
								</Empty.Media>
								<Empty.Title>No Event Games</Empty.Title>
								<Empty.Description>No Event Games found</Empty.Description>
							</Empty.Header>
						</Empty.Root>
					{:else}
						<div class="grid h-fit w-full grid-cols-2 gap-4">
							{#each query.current as game (game.name)}
								{@const emoji = game.icon ? data.emojis.find((e) => e.id === game.icon) : undefined}
								<div class="flex items-center justify-between gap-2 rounded-lg border bg-muted p-2">
									<div class="flex items-center gap-3">
										{#if emoji}
											<img
												src={`https://cdn.discordapp.com/emojis/${emoji.id}.webp?size=96&quality=lossless${emoji.animated ? '&animated=true' : ''}`}
												class="size-6 rounded-md"
												alt={game.name}
											/>
										{:else}
											<ImageOffIcon size={24} />
										{/if}
										<span class="text-base-content/60 text-sm">{game.name}</span>
									</div>
									{#if canManageGames}
										<Button onclick={() => eventGameDialog?.open(game)} variant="ghost" size="icon">
											<Pencil size={24} />
										</Button>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
				</Card.Content>
			</Card.Root>
		{/if}

		<Card.Root>
			<Card.Header>
				<Card.Title>Upcoming Customs</Card.Title>
				<Card.Description>
					{#if data.customs}{data.customs.length} scheduled{:else}None scheduled{/if}
				</Card.Description>
				<Card.Action>
					<Button disabled={!query?.ready} onclick={() => newEventDialog?.open()}>
						<Plus />Create
					</Button>
				</Card.Action>
			</Card.Header>
			<Card.Content class="flex h-64 overflow-y-auto">
				{#if !data.customs || data.customs.length === 0}
					<Empty.Root>
						<Empty.Header>
							<Empty.Media variant="icon">
								<Clock class="opacity-40" />
							</Empty.Media>
							<Empty.Title>No Data</Empty.Title>
							<Empty.Description>No upcoming customs scheduled</Empty.Description>
						</Empty.Header>
					</Empty.Root>
				{:else}
					<div class="grid h-fit w-full grid-cols-2 gap-4">
						{#each data.customs as custom (custom.id)}
							{@const timer = format_countdown(custom.scheduledTime)}
							{@const server = data.servers?.find((s) => s.id === custom.guildId)}
							{#if timer !== null}
								<div class="flex items-center justify-between gap-2 rounded-lg border bg-muted p-2">
									<div class="flex items-center gap-3">
										<Avatar.Root size="sm">
											<Avatar.Image class="rounded-lg" src={server?.icon} alt={server?.name} />
											<Avatar.Fallback>
												{server?.name ? server.name.charAt(0) : '?'}
											</Avatar.Fallback>
										</Avatar.Root>
										<span class="text-sm">{custom.gameName}</span>
									</div>
									{#if timer === 'now'}
										<div class="flex items-center gap-1.5">
											<span class="loading loading-xs loading-spinner text-error"></span>
											<span class="text-error text-sm font-semibold">Starting</span>
										</div>
									{:else if timer}
										<div
											class="flex shrink-0 items-center gap-1 font-mono text-sm text-muted-foreground"
										>
											{#if timer.h > 0}{timer.h.toString()}h{/if}
											{#if timer.m > 0}{timer.m.toString().padStart(2, '0')}m{/if}
											{#if timer.h === 0}{timer.s.toString().padStart(2, '0')}s{/if}
										</div>
									{/if}
								</div>
							{/if}
						{/each}
					</div>
				{/if}
			</Card.Content>
		</Card.Root>
	</div>
	{#if query?.ready}
		<NewEventDialog
			emojis={data.emojis}
			eventGames={query?.current}
			bind:this={newEventDialog}
			guilds={data.servers}
		/>
	{/if}
{:else}
	<Empty.Root>
		<Empty.Header>
			<Bot class="text-primary" size={48} />
			<Empty.Title class="text-3xl font-bold text-primary">JessJessBot</Empty.Title>
			<Empty.Description>
				<p>Serving {data.bot_guild_count} servers</p>
				<p>
					<Button
						class="p-0"
						variant="link"
						onclick={() =>
							authClient.signIn.social({
								provider: 'discord',
							})}
					>
						Login
					</Button> to access the dashboard
				</p>
			</Empty.Description>
		</Empty.Header>
	</Empty.Root>
{/if}

{#if canManageGames}
	<EventGameDialog emojis={data.emojis} bind:this={eventGameDialog} />
{/if}
