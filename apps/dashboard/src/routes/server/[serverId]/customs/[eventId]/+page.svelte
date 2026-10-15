<script lang="ts">
	import type { PageProps } from './$types';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card/index.js';
	let { data }: PageProps = $props();
</script>

<div class="container mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
	<a href={`/server/${data.event.guildId}`} class="text-sm text-muted-foreground hover:underline">
		← Back to server
	</a>
	<div>
		<h1 class="text-3xl font-bold">{data.event.name}</h1>
		<p class="text-muted-foreground">{new Date(data.event.scheduledTime).toLocaleString()}</p>
	</div>
	<a href={data.event.messageUrl} target="_blank" rel="noopener noreferrer">
		<Button variant="outline">Open signup in Discord</Button>
	</a>
	<div class="grid gap-4 sm:grid-cols-2">
		{#each data.groups as group (group.emoji)}
			<Card.Root>
				<Card.Header>
					<Card.Title>
						{data.event.teamCount
							? `Team ${group.emoji}`
							: group.status === 'MAYBE'
								? 'Maybe'
								: 'Signed up'} · {group.users.length}
					</Card.Title>
				</Card.Header>
				<Card.Content>
					{#if group.users.length}
						<ul class="space-y-2">
							{#each group.users as user (user.id)}
								<li>{user.name}</li>
							{/each}
						</ul>
					{:else}
						<p class="text-muted-foreground">No one yet.</p>
					{/if}
				</Card.Content>
			</Card.Root>
		{/each}
	</div>
</div>
