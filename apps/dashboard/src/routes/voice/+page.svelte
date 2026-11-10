<script lang="ts">
	import type { PageProps } from './$types';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { RotateCcwIcon, SaveIcon } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { editVoice } from '$lib/voice.remote';
	import { PERSONALITY_DEFAULT, PERSONALITY_LIMITS } from '@repo/database/defaults';

	let { data }: PageProps = $props();

	// svelte-ignore state_referenced_locally
	let personality = $state(data.voice.personality);
	let submitting = $state(false);

	async function save() {
		submitting = true;
		try {
			await editVoice({ personality });
			toast.success('Saved jjb’s personality. Every server gets it within a minute.');
		} catch {
			toast.error(`Could not save. Keep it under ${PERSONALITY_LIMITS.personality} characters.`);
		} finally {
			submitting = false;
		}
	}
</script>

<div class="mx-auto flex max-w-5xl flex-col gap-4 p-4">
	<Card.Root>
		<Card.Header>
			<Card.Title>jjb’s personality</Card.Title>
			<Card.Description>
				Who she is and how she talks, in every server. Leave it empty to use her default (shown
				faded). Tool and safety rules stay in code and are always added after this.
			</Card.Description>
			<Card.Action>
				<Button onclick={save} disabled={submitting}>
					<SaveIcon />
					Save
				</Button>
			</Card.Action>
		</Card.Header>
		<Card.Content class="flex flex-col gap-3">
			<Field.Field>
				<div class="flex items-center justify-between gap-2">
					<Field.Label for="voice-personality">Personality</Field.Label>
					<div class="flex items-center gap-2">
						{#if !personality}
							<Button
								variant="outline"
								size="sm"
								onclick={() => (personality = PERSONALITY_DEFAULT)}
								disabled={submitting}
							>
								Edit default
							</Button>
						{/if}
						<Button
							variant="ghost"
							size="sm"
							onclick={() => (personality = '')}
							disabled={submitting}
						>
							<RotateCcwIcon />
							Default
						</Button>
					</div>
				</div>
				<textarea
					id="voice-personality"
					class="min-h-[32rem] w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
					maxlength={PERSONALITY_LIMITS.personality}
					placeholder={PERSONALITY_DEFAULT}
					bind:value={personality}
					disabled={submitting}
				></textarea>
				<Field.Description>
					{personality.length}/{PERSONALITY_LIMITS.personality}
				</Field.Description>
			</Field.Field>
			{#if data.voice.updatedAt}
				<p class="text-xs text-muted-foreground">
					Last saved {new Date(data.voice.updatedAt).toLocaleString()}
				</p>
			{/if}
		</Card.Content>
	</Card.Root>
</div>
