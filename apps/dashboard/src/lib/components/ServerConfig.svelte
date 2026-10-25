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
			bot_ignored_channels: string[];
		};
		guildId: string;
	} = $props();

	// svelte-ignore state_referenced_locally
	let channelId = $state(config.custom_channel);
	// svelte-ignore state_referenced_locally
	let ignoredChannels = $state(new Set(config.bot_ignored_channels));
	let submitting = $state(false);
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>Server Config</Card.Title>

		<Card.Action>
			<Button
				onclick={async () => {
					submitting = true;
					editConfig({
						guildId,
						custom_channel: channelId || null,
						bot_ignored_channels: [...ignoredChannels],
					})
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

	<Card.Content class="max-h-96 space-y-5 overflow-y-auto">
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
		<div class="space-y-3">
			<div>
				<p class="text-sm font-semibold">Bot replies by channel</p>
				<p class="text-xs text-muted-foreground">
					Only checked channels are ignored. Slash commands still work.
				</p>
			</div>
			{#each channels as channel (channel.id)}
				<Field.Field orientation="horizontal">
					<input
						id={`bot-policy-${channel.id}`}
						type="checkbox"
						class="checkbox checkbox-primary"
						checked={ignoredChannels.has(channel.id)}
						disabled={submitting}
						onchange={(event) => {
							const updated = new Set(ignoredChannels);
							if (event.currentTarget.checked) updated.add(channel.id);
							else updated.delete(channel.id);
							ignoredChannels = updated;
						}}
					/>
					<Field.Label for={`bot-policy-${channel.id}`}>{channel.name}</Field.Label>
				</Field.Field>
			{/each}
		</div>
	</Card.Content>
</Card.Root>
