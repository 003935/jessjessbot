<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import type { LayoutProps } from './$types';
	import { authClient } from '$lib/auth.client';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Toaster } from 'svelte-sonner';
	import LogOut from '@lucide/svelte/icons/log-out';
	import Bot from '@lucide/svelte/icons/bot';
	import User from '@lucide/svelte/icons/user';

	let { data, children }: LayoutProps = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="flex min-h-screen flex-col">
	<div
		class="navbar sticky top-0 z-50 border-b border-base-300/50 bg-base-100/90 px-4 shadow-md backdrop-blur-md lg:px-8"
	>
		<div class="flex-1">
			<button
				class="btn gap-2 text-xl font-bold normal-case btn-ghost hover:bg-transparent"
				onclick={() => goto(resolve('/'))}
			>
				<div class="rounded-lg bg-linear-to-br from-primary to-secondary p-1.5">
					<Bot size={22} class="text-white" />
				</div>
				<span class="bg-linear-to-r from-primary to-secondary bg-clip-text text-transparent">
					jessjessbot
				</span>
			</button>
		</div>
		<div class="flex-none gap-2">
			{#if data.user}
				<div class="dropdown dropdown-end">
					<div
						tabindex="0"
						role="button"
						class="btn gap-2 rounded-lg btn-ghost transition-all hover:bg-base-200"
					>
						<div class="online avatar">
							<div
								class="w-9 rounded-full ring-2 ring-primary/30 ring-offset-1 ring-offset-base-100"
							>
								<img src={data.user.image} alt="" />
							</div>
						</div>
						<div class="flex max-w-[120px] flex-col items-start">
							<span class="truncate text-sm font-semibold">{data.user.name}</span>
							<span class="text-xs text-base-content/60 capitalize">{data.user.role}</span>
						</div>
					</div>
					<ul
						tabindex="-1"
						class="dropdown-content menu z-50 mt-3 w-56 rounded-xl border border-base-300/50 bg-base-200 p-2 shadow-xl"
					>
						{#if data.discordId}
							<li>
								<button class="rounded-lg" onclick={() => goto(resolve(`/user/${data.discordId}`))}>
									<User size={16} />
									My Stats
								</button>
							</li>
						{/if}
						<li>
							<button
								class="rounded-lg text-error transition-colors hover:bg-error/10 hover:text-error"
								onclick={() =>
									authClient.signOut({
										fetchOptions: {
											onSuccess: () => {
												goto(resolve('/'), {
													invalidateAll: true,
												});
											},
										},
									})}
							>
								<LogOut size={16} />
								Logout
							</button>
						</li>
					</ul>
				</div>
			{:else}
				<button
					class="btn gap-2 rounded-lg shadow-md transition-all btn-primary hover:shadow-lg"
					onclick={() =>
						authClient.signIn.social({
							provider: 'discord',
						})}
				>
					<svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
						<path
							d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"
						/>
					</svg>
					Login with Discord
				</button>
			{/if}
		</div>
	</div>

	<main class="flex-1">
		{@render children()}
	</main>

	<footer class="mt-auto border-t border-base-300/50 bg-base-100/50 backdrop-blur-sm">
		<div
			class="container mx-auto flex flex-col items-center justify-between gap-4 px-4 py-6 sm:flex-row"
		>
			<div class="flex items-center gap-2 text-sm text-base-content/60">
				<div class="rounded bg-linear-to-br from-primary/20 to-secondary/20 p-1">
					<Bot size={14} class="text-primary" />
				</div>
				<span>jessjessbot Dashboard</span>
			</div>
			<div class="text-sm text-base-content/50">
				&copy; {new Date().getFullYear()} All rights reserved
			</div>
		</div>
	</footer>
</div>

<Toaster
	theme="dark"
	position="bottom-right"
	style="font-family: inherit;"
	toastOptions={{
		classes: {
			toast: 'bg-base-200! text-base-content! border border-base-300/50!',
			error: 'bg-error! text-error-content! border-error/50!',
			success: 'bg-success! text-success-content! border-success/50!',
			warning: 'bg-warning! text-warning-content! border-warning/50!',
			info: 'bg-info! text-info-content! border-info/50!',
			loader: 'animate-spin',
			actionButton: 'bg-neutral! text-neutral-content!',
			description: 'text-neutral!',
		},
		duration: 4000,
	}}
/>
