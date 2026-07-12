<script lang="ts">
	import { getEmojis } from '$lib/discord.remote';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import {
		addEventGame,
		getEventGames,
		removeEventGame,
		updateEventGame,
	} from '$lib/eventGame.remote';
	import { toast } from 'svelte-sonner';
	import { formatDistanceToNow } from 'date-fns';
	import {
		createForm,
		Field as SField,
		Form,
		reset,
		submit,
		type SubmitEventHandler,
	} from '@formisch/svelte';
	import { isHttpError } from '@sveltejs/kit';
	import Gamepad2 from '@lucide/svelte/icons/gamepad-2';
	import Image from '@lucide/svelte/icons/image';
	import AlertCircle from '@lucide/svelte/icons/alert-circle';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import * as Field from '$lib/components/ui/field/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import type { APIApplicationEmoji } from 'discord-api-types/v10';
	import { EventGame_Schema, type EventGame } from '$lib/eventGame.utils';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import Calendar from '$lib/components/ui/calendar/calendar.svelte';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import { getLocalTimeZone } from '@internationalized/date';
	import type { CalendarDate } from '@internationalized/date';
	import DateTimePicker from '$lib/components/DateTimePicker.svelte';
	import { Spinner } from './ui/spinner';
	import { Custom_Schema } from '$lib/event.utils';
	import { createEvent } from '$lib/event.remote';

	const form = createForm({
		schema: Custom_Schema,
		initialInput: {
			guildId: '',
			time: new Date().toISOString(),
			gameName: '',
			name: '',
		},
	});

	export function open() {
		is_open = true;
	}

	let is_open = $state(false);

	let {
		eventGames,
		emojis,
		guilds,
	}: {
		eventGames: {
			name: string;
			icon: string | null;
		}[];
		emojis: {
			id: string;
			animated?: boolean;
			name: string | null;
		}[];
		guilds: {
			id: string;
			name: string;
			icon: string | null;
			owner: boolean;
			permissions: string;
		}[];
	} = $props();

	let games = $derived(
		eventGames.map((g) => {
			const emoji = emojis.find((e) => g.icon === e.id);
			return {
				...g,
				emoji,
			};
		})
	);

	const handleSubmit: SubmitEventHandler<typeof Custom_Schema> = async (output) => {
		try {
			await createEvent(output);
			is_open = false;
			toast.success('Created Event');
		} catch (error) {
			console.error(error);
			toast.error('Something went wrong');
		}
	};
</script>

<Dialog.Root
	open={is_open}
	onOpenChangeComplete={(open) => {
		if (open === false) {
			is_open = false;
			reset(form);
		}
	}}
>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Create Event</Dialog.Title>
		</Dialog.Header>
		<Form of={form} onsubmit={handleSubmit} class="flex flex-col gap-4">
			<SField of={form} path={['guildId']}>
				{#snippet children(field)}
					<Field.Field data-invalid={field.errors ? 'true' : undefined}>
						<Field.Label>Server</Field.Label>
						<Select.Root
							type="single"
							{...field.props}
							value={field.input}
							onValueChange={(value) => field.onInput(value)}
						>
							<Select.Trigger>
								{#if field.input}
									{@const guild = guilds.find((g) => g.id === field.input)}
									{#if guild}
										<div class="flex items-center gap-2">
											{#if guild.icon}
												<img src={guild.icon} alt="" class="h-6 w-6" />
											{/if}
											{guild.name}
										</div>
									{:else}
										<p class="text-destructive">Invalid Guild</p>
									{/if}
								{:else}
									Select a server
								{/if}
							</Select.Trigger>
							<Select.Content>
								{#each guilds as guild (guild.id)}
									<Select.Item value={guild.id}>
										<div class="flex items-center gap-2">
											{#if guild.icon}
												<img src={guild.icon} alt="" class="h-6 w-6" />
											{/if}
											{guild.name}
										</div>
									</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
						{#if field.errors}
							<Field.Error>
								{field.errors[0]}
							</Field.Error>
						{/if}
					</Field.Field>
				{/snippet}
			</SField>
			<SField of={form} path={['gameName']}>
				{#snippet children(field)}
					<Field.Field data-invalid={field.errors ? 'true' : undefined}>
						<Field.Label>Game</Field.Label>
						<Select.Root
							type="single"
							{...field.props}
							value={field.input}
							onValueChange={(value) => field.onInput(value)}
						>
							<Select.Trigger>
								{#if field.input}
									{@const emoji = games.find((g) => g.name === field.input)?.emoji}
									<div class="flex items-center gap-2">
										{#if emoji}
											<img
												src={`https://cdn.discordapp.com/emojis/${emoji.id}.webp?size=96&quality=lossless${emoji.animated ? '&animated=true' : ''}`}
												alt=""
												class="h-6 w-6"
											/>
										{/if}
										{field.input}
									</div>
								{:else}
									Select a game
								{/if}
							</Select.Trigger>
							<Select.Content>
								{#each games as game (game.name)}
									<Select.Item value={game.name}>
										<div class="flex items-center gap-2">
											{#if game.emoji}
												<img
													src={`https://cdn.discordapp.com/emojis/${game.emoji.id}.webp?size=96&quality=lossless${game.emoji.animated ? '&animated=true' : ''}`}
													alt=""
													class="h-6 w-6"
												/>
											{/if}
											{game.name}
										</div>
									</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
						{#if field.errors}
							<Field.Error>
								{field.errors[0]}
							</Field.Error>
						{/if}
					</Field.Field>
				{/snippet}
			</SField>

			<SField of={form} path={['time']}>
				{#snippet children(field)}
					<Field.Field data-invalid={field.errors ? 'true' : undefined}>
						<Field.Label>Date & Time</Field.Label>
						<DateTimePicker
							value={field.input}
							onValueChange={(v) => {
								field.onInput(v);
							}}
						/>
						{#if field.errors}
							<Field.Error>
								{field.errors[0]}
							</Field.Error>
						{/if}

						{#if field.input}
							<Field.Description>
								{formatDistanceToNow(new Date(field.input), { addSuffix: true })}
							</Field.Description>
						{/if}
					</Field.Field>
				{/snippet}
			</SField>

			<SField of={form} path={['name']}>
				{#snippet children(field)}
					<Field.Field data-invalid={field.errors ? 'true' : undefined}>
						<Field.Label>Custom Name</Field.Label>
						<Input
							{...field.props}
							value={field.input}
							type="text"
							placeholder="Enter custom name"
							aria-invalid={field.errors ? 'true' : undefined}
						/>
						{#if field.errors}
							<Field.Error>
								{field.errors[0]}
							</Field.Error>
						{/if}
						<Field.Description>
							The event name will default to the game name if this field is not filled.
						</Field.Description>
					</Field.Field>
				{/snippet}
			</SField>
		</Form>
		<Dialog.Footer>
			<Button disabled={form.isSubmitting || !form.isDirty} onclick={() => submit(form)}>
				{#if form.isSubmitting}
					<Spinner />
				{/if}
				Create
			</Button>
			<Button
				variant="outline"
				disabled={form.isSubmitting}
				onclick={() => {
					is_open = false;
				}}
			>
				Cancel
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
