<script lang="ts">
	import { page } from '$app/state';
	import { authClient } from '$lib/auth.client';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Empty from '$lib/components/ui/empty/index.js';
	import { Bot, CircleXIcon } from '@lucide/svelte';
</script>

{#if page.status === 401}
	<Empty.Root>
		<Empty.Header>
			<Bot class="text-primary" size={48} />
			<Empty.Title class="text-3xl font-bold text-primary">JessJessBot</Empty.Title>
			<Empty.Description>
				<p>
					<Button
						class="p-0"
						variant="link"
						onclick={() =>
							authClient.signIn.social({
								provider: 'discord',
								callbackURL: window.location.pathname,
							})}
					>
						Login
					</Button> to access the dashboard
				</p>
			</Empty.Description>
		</Empty.Header>
	</Empty.Root>
{:else}
	<Empty.Root>
		<Empty.Header>
			<CircleXIcon class="text-primary" size={48} />
			<Empty.Title class="text-3xl font-bold text-primary">{page.status}</Empty.Title>
			<Empty.Description>
				<p>
					{page.error?.message}
				</p>
			</Empty.Description>
		</Empty.Header>
	</Empty.Root>
{/if}
