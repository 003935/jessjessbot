<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import type { LayoutProps } from './$types';
	import { authClient } from '$lib/auth-client';
	import { goto } from '$app/navigation';

	let { data, children }: LayoutProps = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="navbar bg-base-200 shadow-sm">
	<div class="flex-1 px-2">
		<a href="/" class="text-xl">jessjessbot</a>
	</div>
	<div class="flex-none px-2">
		{#if data.user}
			<div class="dropdown dropdown-end">
				<div tabindex="0" role="button" class="btn btn-ghost">
					<div>{data.user.name}</div>
					<div class="avatar">
						<div class="w-10 rounded-full">
							<img src={data.user.image} alt="" />
						</div>
					</div>
				</div>
				<ul
					tabindex="-1"
					class="dropdown-content menu z-1 mt-3 w-52 menu-sm rounded-box bg-base-300 p-2 shadow"
				>
					<li>
						<button
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
							Logout
						</button>
					</li>
				</ul>
			</div>
		{:else}
			<button
				class="btn btn-primary"
				onclick={() =>
					authClient.signIn.social({
						provider: 'discord',
					})}
			>
				Login
			</button>
		{/if}
	</div>
</div>

{@render children()}
