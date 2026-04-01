<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import type { LayoutProps } from './$types';
	import { authClient } from '$lib/auth.client';
	import { goto } from '$app/navigation';
	import { Toaster } from 'svelte-sonner';
	import LogOut from '@lucide/svelte/icons/log-out';
	import type { Snippet } from 'svelte';

	let { data, children }: LayoutProps = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="navbar bg-base-100/80 backdrop-blur-md shadow-lg sticky top-0 z-50 border-b border-base-300">
	<div class="flex-1">
		<a href="/" class="btn btn-ghost text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
			jessjessbot
		</a>
	</div>
	<div class="flex-none gap-2">
		{#if data.user}
			<div class="dropdown dropdown-end">
				<div tabindex="0" role="button" class="btn btn-ghost gap-2 hover:bg-base-200 transition-all">
					<div class="avatar online">
						<div class="w-10 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
							<img src={data.user.image} alt="" />
						</div>
					</div>
					<div class="flex flex-col items-start">
						<span class="text-sm font-semibold">{data.user.name}</span>
						<span class="text-xs text-base-content/70 capitalize">{data.user.role}</span>
					</div>
				</div>
				<ul
					tabindex="-1"
					class="dropdown-content menu z-1 mt-3 w-52 menu-sm rounded-box bg-base-200 p-2 shadow-xl border border-base-300"
				>
					<li>
						<button
							class="text-error hover:bg-error hover:text-error-content transition-colors"
							onclick={() =>
								authClient.signOut({
									fetchOptions: {
										onSuccess: () => {
											goto('/', {
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
				class="btn btn-primary gap-2 shadow-lg hover:shadow-xl transition-all"
				onclick={() =>
					authClient.signIn.social({
						provider: 'discord',
					})}
			>
				<LogOut size={20} />
				Login with Discord
			</button>
		{/if}
	</div>
</div>

{@render children()}

<Toaster
	theme="dark"
	style="font-family: inherit;"
	toastOptions={{
		classes: {
			toast: 'bg-base-200! text-base-content!',
			error: 'bg-error! text-error-content!',
			success: 'bg-success! text-success-content!',
			warning: 'bg-warning! text-warning-content!',
			loader: 'animate-spin',
			actionButton: 'bg-neutral! text-neutral-content!',
			description: 'text-neutral!',
		},
	}}
/>
