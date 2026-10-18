<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import { Button } from './ui/button';
	import { Input } from './ui/input';
	import { SaveIcon, XIcon } from '@lucide/svelte';
	import { editPersonality, forgetAllOpinions, forgetOpinion } from '$lib/personality.remote';
	import { toast } from 'svelte-sonner';
	import { PERSONALITY_LIMITS } from '@repo/database/defaults';

	let {
		guildId,
		personality: initial,
		opinions: initialOpinions,
	}: {
		guildId: string;
		personality: { personality: string; likes: string[]; dislikes: string[]; lore: string };
		opinions: Array<{ topic: string; opinion: string; updatedAt: string }>;
	} = $props();

	// svelte-ignore state_referenced_locally
	let personality = $state(initial.personality);
	// svelte-ignore state_referenced_locally
	let lore = $state(initial.lore);
	// svelte-ignore state_referenced_locally
	let likes = $state(initial.likes.join(', '));
	// svelte-ignore state_referenced_locally
	let dislikes = $state(initial.dislikes.join(', '));
	// svelte-ignore state_referenced_locally
	let opinions = $state(initialOpinions);
	let submitting = $state(false);

	const list = (text: string) =>
		[...new Set(text.split(',').map((item) => item.trim().toLowerCase()))].filter(Boolean);

	async function save() {
		submitting = true;
		try {
			await editPersonality({
				guildId,
				personality,
				likes: list(likes),
				dislikes: list(dislikes),
				lore,
			});
			toast.success('Saved jjb’s personality');
		} catch {
			toast.error('Could not save. Keep likes and dislikes under 15 items of 40 characters.');
		} finally {
			submitting = false;
		}
	}

	async function forget(topic: string) {
		try {
			await forgetOpinion({ guildId, topic });
			opinions = opinions.filter((entry) => entry.topic !== topic);
		} catch {
			toast.error('Could not delete that opinion');
		}
	}

	async function forgetAll() {
		if (!confirm('Delete every opinion jjb has picked up in this server?')) return;
		try {
			await forgetAllOpinions({ guildId });
			opinions = [];
		} catch {
			toast.error('Could not delete her opinions');
		}
	}
</script>

<Card.Root class="col-span-2">
	<Card.Header>
		<Card.Title>JJB personality</Card.Title>
		<Card.Description>
			Fine-tune how jjb acts in this server and see the notes she keeps from chat. Changes
			reach her within a minute.
		</Card.Description>
		<Card.Action>
			<Button onclick={save} disabled={submitting}>
				<SaveIcon />
				Save
			</Button>
		</Card.Action>
	</Card.Header>
	<Card.Content class="grid gap-6 md:grid-cols-2">
		<div class="flex flex-col gap-5">
			<Field.Field>
				<Field.Label for="jjb-personality">Extra personality</Field.Label>
				<textarea
					id="jjb-personality"
					class="min-h-36 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
					maxlength={1500}
					placeholder="e.g. she is obsessed with frogs. she thinks the league players here are all hardstuck silver. she calls the server 'the swamp'."
					bind:value={personality}
					disabled={submitting}
				></textarea>
				<Field.Description>
					Added on top of her built-in personality. {personality.length}/1500
				</Field.Description>
			</Field.Field>
			<Field.Field>
				<Field.Label for="jjb-lore">Server lore</Field.Label>
				<textarea
					id="jjb-lore"
					class="min-h-36 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
					maxlength={PERSONALITY_LIMITS.lore}
					placeholder="e.g. a friends' server that started as a league group. 'the fat club' is the server nickname. regulars: ..."
					bind:value={lore}
					disabled={submitting}
				></textarea>
				<Field.Description>
					What this server is about, inside jokes, who the regulars are. She already knows the server and channel names. {lore.length}/{PERSONALITY_LIMITS.lore}
				</Field.Description>
			</Field.Field>
			<Field.Field>
				<Field.Label for="jjb-likes">Likes</Field.Label>
				<Input
					id="jjb-likes"
					placeholder="kittens, mangoes"
					bind:value={likes}
					disabled={submitting}
				/>
				<Field.Description>
					Comma separated. Leave both empty to use her defaults.
				</Field.Description>
			</Field.Field>
			<Field.Field>
				<Field.Label for="jjb-dislikes">Dislikes</Field.Label>
				<Input
					id="jjb-dislikes"
					placeholder="wasabi, ginger"
					bind:value={dislikes}
					disabled={submitting}
				/>
			</Field.Field>
		</div>
		<div class="flex min-w-0 flex-col gap-3">
			<div class="flex items-center justify-between gap-3">
				<p class="text-sm font-semibold">Notes</p>
				{#if opinions.length}
					<Button variant="outline" size="sm" onclick={forgetAll}>Delete all</Button>
				{/if}
			</div>
			<div class="flex max-h-80 flex-col gap-2 overflow-y-auto">
				{#if opinions.length === 0}
					<p class="text-sm text-muted-foreground">No opinions yet. Ask her what she thinks.</p>
				{:else}
					{#each opinions as entry (entry.topic)}
						<div class="flex items-start justify-between gap-3 rounded-lg border p-2">
							<p class="min-w-0 text-sm">
								<span class="font-medium">{entry.topic}</span>
								<span class="text-muted-foreground">· {entry.opinion}</span>
							</p>
							<Button
								variant="ghost"
								size="icon"
								aria-label={`Delete opinion on ${entry.topic}`}
								onclick={() => forget(entry.topic)}
							>
								<XIcon />
							</Button>
						</div>
					{/each}
				{/if}
			</div>
		</div>
	</Card.Content>
</Card.Root>
