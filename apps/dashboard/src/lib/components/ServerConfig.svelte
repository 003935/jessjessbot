<script lang="ts">
	import * as Select from '$lib/components/ui/select/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { SaveIcon } from '@lucide/svelte';
	import { Button } from './ui/button';
	import { editConfig } from '$lib/config.remote';
	import { toast } from 'svelte-sonner';

	let {
		channels,
		config,
		guildId,
	}: {
		channels: {
			name: string;
			id: string;
		}[];
		config: {
			custom_channel?: string;
		};
		guildId: string;
	} = $props();

	// svelte-ignore state_referenced_locally
	let channelId = $state(config.custom_channel);
	let submitting = $state(false);
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>Server Config</Card.Title>

		<Card.Action>
			<Button
				onclick={async () => {
					submitting = true;
					editConfig({ guildId, custom_channel: channelId })
						.then(() => {
							toast.success('Updated server config');
						})
						.catch(() => {
							toast.error('Failed to update server config');
						})
						.finally(() => {
							submitting = false;
						});
				}}
				disabled={submitting}
			>
				<SaveIcon />
				Save
			</Button>
		</Card.Action>
	</Card.Header>

	<Card.Content class="h-64">
		<Field.Field>
			<Field.Label for="custom_channel">Events Channel</Field.Label>
			<Select.Root type="single" bind:value={channelId} disabled={submitting}>
				<Select.Trigger id="custom_channel">
					{channelId
						? (channels.find((c) => c.id === channelId)?.name ?? channelId)
						: 'Choose a channel'}
				</Select.Trigger>
				<Select.Content>
					{#each channels as channel (channel.id)}
						<Select.Item value={channel.id}>{channel.name}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
			<Field.Description>
				Select the channel for the bot to send event announcements to.
			</Field.Description>
		</Field.Field>
	</Card.Content>
</Card.Root>
