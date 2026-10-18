<script lang="ts">
	import type { PageProps } from './$types';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { RotateCcwIcon, SaveIcon } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { editVoice } from '$lib/voice.remote';
	import {
		DEFAULT_DISLIKES,
		DEFAULT_LIKES,
		FOOD_TASTES_DEFAULT,
		PERSONALITY_LIMITS,
		VOICE_DEFAULTS,
	} from '@repo/database/defaults';

	let { data }: PageProps = $props();

	type Key = 'identity' | 'style' | 'rules' | 'examples' | 'emoji' | 'foodTastes';
	const fields: Array<{ key: Key; label: string; help: string; fallback: string; max: number }> = [
		{ key: 'identity', label: 'Identity', help: 'Who she is and who made her.', fallback: VOICE_DEFAULTS.identity, max: PERSONALITY_LIMITS.identity },
		{ key: 'style', label: 'How she texts', help: 'Tone, length, casing, what a real-friend reply looks like.', fallback: VOICE_DEFAULTS.style, max: PERSONALITY_LIMITS.style },
		{ key: 'rules', label: 'Rules', help: 'Things she never does, how she handles jokes, politics and serious moments.', fallback: VOICE_DEFAULTS.rules, max: PERSONALITY_LIMITS.rules },
		{ key: 'examples', label: 'Example replies', help: 'Replies the server loved, for style only.', fallback: VOICE_DEFAULTS.examples, max: PERSONALITY_LIMITS.examples },
		{ key: 'emoji', label: 'Emoji', help: 'Which emoji and kaomoji she may use.', fallback: VOICE_DEFAULTS.emoji, max: PERSONALITY_LIMITS.emoji },
		{ key: 'foodTastes', label: 'Food tastes', help: 'Only added when people talk about food.', fallback: FOOD_TASTES_DEFAULT, max: PERSONALITY_LIMITS.foodTastes },
	];

	// svelte-ignore state_referenced_locally
	let values = $state<Record<Key, string>>({
		identity: data.voice.identity,
		style: data.voice.style,
		rules: data.voice.rules,
		examples: data.voice.examples,
		emoji: data.voice.emoji,
		foodTastes: data.voice.foodTastes,
	});
	// svelte-ignore state_referenced_locally
	let likes = $state(data.voice.likes.join(', '));
	// svelte-ignore state_referenced_locally
	let dislikes = $state(data.voice.dislikes.join(', '));
	let submitting = $state(false);

	const list = (text: string) =>
		[...new Set(text.split(',').map((item) => item.trim().toLowerCase()))].filter(Boolean);

	async function save() {
		submitting = true;
		try {
			await editVoice({ ...values, likes: list(likes), dislikes: list(dislikes) });
			toast.success('Saved jjb’s voice. Every server gets it within a minute.');
		} catch {
			toast.error('Could not save her voice. Check the length limits.');
		} finally {
			submitting = false;
		}
	}
</script>

<div class="mx-auto flex max-w-5xl flex-col gap-4 p-4">
	<Card.Root>
		<Card.Header>
			<Card.Title>jjb’s voice</Card.Title>
			<Card.Description>
				Her core personality in every server. Leave a box empty to use her default (shown faded);
				“Default” clears your edit. Tool and safety rules stay in code and are always added after this.
			</Card.Description>
			<Card.Action>
				<Button onclick={save} disabled={submitting}>
					<SaveIcon />
					Save
				</Button>
			</Card.Action>
		</Card.Header>
		<Card.Content class="flex flex-col gap-6">
			{#each fields as field (field.key)}
				<Field.Field>
					<div class="flex items-center justify-between gap-2">
						<Field.Label for={`voice-${field.key}`}>{field.label}</Field.Label>
						<div class="flex items-center gap-2">
							{#if !values[field.key]}
								<Button variant="outline" size="sm" onclick={() => (values[field.key] = field.fallback)} disabled={submitting}>
									Edit default
								</Button>
							{/if}
							<Button variant="ghost" size="sm" onclick={() => (values[field.key] = '')} disabled={submitting}>
								<RotateCcwIcon />
								Default
							</Button>
						</div>
					</div>
					<textarea
						id={`voice-${field.key}`}
						class="min-h-40 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
						maxlength={field.max}
						placeholder={field.fallback}
						bind:value={values[field.key]}
						disabled={submitting}
					></textarea>
					<Field.Description>{field.help} {values[field.key].length}/{field.max}</Field.Description>
				</Field.Field>
			{/each}
			<div class="grid gap-4 md:grid-cols-2">
				<Field.Field>
					<Field.Label for="voice-likes">Default likes</Field.Label>
					<Input id="voice-likes" placeholder={DEFAULT_LIKES.join(', ')} bind:value={likes} disabled={submitting} />
					<Field.Description>Comma separated. A server’s own likes override these.</Field.Description>
				</Field.Field>
				<Field.Field>
					<Field.Label for="voice-dislikes">Default dislikes</Field.Label>
					<Input id="voice-dislikes" placeholder={DEFAULT_DISLIKES.join(', ')} bind:value={dislikes} disabled={submitting} />
				</Field.Field>
			</div>
			{#if data.voice.updatedAt}
				<p class="text-xs text-muted-foreground">Last saved {new Date(data.voice.updatedAt).toLocaleString()}</p>
			{/if}
		</Card.Content>
	</Card.Root>
</div>
