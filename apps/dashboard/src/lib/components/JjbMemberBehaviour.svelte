<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import { Button } from './ui/button';
	import { SaveIcon, XIcon } from '@lucide/svelte';
	import { deleteMemberBehaviour, setMemberBehaviour } from '$lib/personality.remote';
	import { toast } from 'svelte-sonner';
	import { PERSONALITY_LIMITS } from '@repo/database/defaults';

	type Behaviour = { userId: string; name: string; behaviour: string; whenUpset: string };

	let {
		guildId,
		members,
		behaviours: initial,
	}: {
		guildId: string;
		members: Array<{ id: string; name: string }>;
		behaviours: Behaviour[];
	} = $props();

	// svelte-ignore state_referenced_locally
	let behaviours = $state(initial);
	let selectedId = $state('');
	let behaviour = $state('');
	let whenUpset = $state('');
	let submitting = $state(false);

	const nameFor = (id: string) => members.find((member) => member.id === id)?.name ?? id;

	function edit(entry: Behaviour) {
		selectedId = entry.userId;
		behaviour = entry.behaviour;
		whenUpset = entry.whenUpset;
	}

	async function save() {
		if (!selectedId || !behaviour.trim()) {
			toast.error('Pick a member and write how she should treat them');
			return;
		}
		submitting = true;
		try {
			await setMemberBehaviour({ guildId, userId: selectedId, behaviour, whenUpset });
			const entry = { userId: selectedId, name: nameFor(selectedId), behaviour: behaviour.trim(), whenUpset: whenUpset.trim() };
			behaviours = [entry, ...behaviours.filter((row) => row.userId !== selectedId)];
			selectedId = '';
			behaviour = '';
			whenUpset = '';
			toast.success(`Saved how jjb treats ${entry.name}`);
		} catch {
			toast.error('Could not save that behaviour');
		} finally {
			submitting = false;
		}
	}

	async function remove(userId: string) {
		try {
			await deleteMemberBehaviour({ guildId, userId });
			behaviours = behaviours.filter((row) => row.userId !== userId);
		} catch {
			toast.error('Could not delete that behaviour');
		}
	}
</script>

<Card.Root class="col-span-2">
	<Card.Header>
		<Card.Title>Member behaviour</Card.Title>
		<Card.Description>
			Give jjb a special way of treating specific people. It replaces how she normally greets and
			addresses them.
		</Card.Description>
	</Card.Header>
	<Card.Content class="grid gap-6 md:grid-cols-2">
		<div class="flex flex-col gap-4">
			<Field.Field>
				<Field.Label for="jjb-behaviour-member">Member</Field.Label>
				<select
					id="jjb-behaviour-member"
					class="select select-sm w-full"
					bind:value={selectedId}
					disabled={submitting}
				>
					<option value="" disabled>Pick someone jjb has talked to</option>
					{#each members as member (member.id)}
						<option value={member.id}>{member.name}</option>
					{/each}
				</select>
			</Field.Field>
			<Field.Field>
				<Field.Label for="jjb-behaviour-text">How to treat them</Field.Label>
				<textarea
					id="jjb-behaviour-text"
					class="min-h-28 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
					maxlength={PERSONALITY_LIMITS.behaviour}
					placeholder="e.g. she's strict with you, so you're on your best behaviour. call her hannie."
					bind:value={behaviour}
					disabled={submitting}
				></textarea>
			</Field.Field>
			<Field.Field>
				<Field.Label for="jjb-behaviour-upset">When they sound upset with her (optional)</Field.Label>
				<textarea
					id="jjb-behaviour-upset"
					class="min-h-20 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
					maxlength={PERSONALITY_LIMITS.whenUpset}
					placeholder="e.g. get a little neurotic and over-apologise"
					bind:value={whenUpset}
					disabled={submitting}
				></textarea>
			</Field.Field>
			<Button class="self-start" onclick={save} disabled={submitting}>
				<SaveIcon />
				Save behaviour
			</Button>
		</div>
		<div class="flex min-w-0 flex-col gap-2">
			<p class="text-sm font-semibold">Set up</p>
			{#if behaviours.length === 0}
				<p class="text-sm text-muted-foreground">Nobody gets special treatment yet.</p>
			{:else}
				{#each behaviours as entry (entry.userId)}
					<div class="flex items-start justify-between gap-3 rounded-lg border p-2">
						<button type="button" class="min-w-0 text-left text-sm" onclick={() => edit(entry)}>
							<span class="font-medium">{entry.name}</span>
							<span class="text-muted-foreground">· {entry.behaviour}</span>
						</button>
						<Button
							variant="ghost"
							size="icon"
							aria-label={`Remove behaviour for ${entry.name}`}
							onclick={() => remove(entry.userId)}
						>
							<XIcon />
						</Button>
					</div>
				{/each}
			{/if}
		</div>
	</Card.Content>
</Card.Root>
