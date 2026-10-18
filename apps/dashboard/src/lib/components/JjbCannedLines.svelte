<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import { Button } from './ui/button';
	import { SaveIcon, RotateCcwIcon } from '@lucide/svelte';
	import { editCannedLines } from '$lib/personality.remote';
	import { toast } from 'svelte-sonner';
	import {
		ANNOYED_LINES,
		CHAT_FALLBACK,
		DEEPSEEK_DOWN_SCENARIOS,
		GREETING_LINES,
		LAZY_LINES,
		MEME_PROMPT,
		PERSONALITY_LIMITS,
	} from '@repo/database/defaults';

	type Saved = {
		greeting: string[];
		annoyed: string[];
		lazy: string[];
		fallback: string;
		downLines: Record<string, string[][]> | null;
		memeEnabled: boolean;
		memePrompt: string;
	};

	let { guildId, saved }: { guildId: string; saved: Saved } = $props();

	const STAGE_BREAK = '---';
	const toText = (lines: string[]) => lines.join('\n');
	const toLines = (text: string) =>
		text
			.split('\n')
			.map((line) => line.trim())
			.filter(Boolean);
	// One textarea per storyline; stages are separated by a line that is just "---".
	const scenarioText = (stages: string[][]) => stages.map(toText).join(`\n${STAGE_BREAK}\n`);
	const scenarioStages = (text: string) =>
		text
			.split(new RegExp(`^\\s*${STAGE_BREAK}\\s*$`, 'mu'))
			.map(toLines)
			.filter((stage) => stage.length);

	// svelte-ignore state_referenced_locally
	let greeting = $state(toText(saved.greeting));
	// svelte-ignore state_referenced_locally
	let annoyed = $state(toText(saved.annoyed));
	// svelte-ignore state_referenced_locally
	let lazy = $state(toText(saved.lazy));
	// svelte-ignore state_referenced_locally
	let fallback = $state(saved.fallback);
	// svelte-ignore state_referenced_locally
	let memeEnabled = $state(saved.memeEnabled);
	// svelte-ignore state_referenced_locally
	let memePrompt = $state(saved.memePrompt);
	// svelte-ignore state_referenced_locally
	let scenarios = $state(
		Object.entries(saved.downLines ?? {}).map(([name, stages]) => ({ name, text: scenarioText(stages) }))
	);
	let submitting = $state(false);

	const lists = $derived([
		{ id: 'greeting', label: 'Greetings', help: 'Sometimes used instead of a reply when someone just says hi.', defaults: GREETING_LINES },
		{ id: 'annoyed', label: 'Annoyed', help: 'Sometimes used when someone is being rude to her.', defaults: ANNOYED_LINES },
		{ id: 'lazy', label: 'Lazy', help: 'Very rarely used instead of answering at all.', defaults: LAZY_LINES.filter(Boolean) },
	] as const);
	const values = { greeting: () => greeting, annoyed: () => annoyed, lazy: () => lazy };
	function setList(id: 'greeting' | 'annoyed' | 'lazy', text: string) {
		if (id === 'greeting') greeting = text;
		else if (id === 'annoyed') annoyed = text;
		else lazy = text;
	}

	function useDefaultScenarios() {
		scenarios = Object.entries(DEEPSEEK_DOWN_SCENARIOS).map(([name, stages]) => ({
			name,
			text: scenarioText(stages),
		}));
	}

	async function save() {
		submitting = true;
		try {
			const downLines = Object.fromEntries(
				scenarios
					.map((scenario) => [scenario.name.trim(), scenarioStages(scenario.text)] as const)
					.filter(([name, stages]) => name && stages.length)
			);
			await editCannedLines({
				guildId,
				greeting: toLines(greeting),
				annoyed: toLines(annoyed),
				lazy: toLines(lazy),
				fallback,
				downLines,
				memeEnabled,
				memePrompt,
			});
			toast.success('Saved jjb’s canned lines');
		} catch {
			toast.error(
				`Could not save. Keep lists under ${PERSONALITY_LIMITS.cannedLines} lines and storylines under ${PERSONALITY_LIMITS.downScenarios}.`
			);
		} finally {
			submitting = false;
		}
	}
</script>

<Card.Root class="col-span-2">
	<Card.Header>
		<Card.Title>Canned lines</Card.Title>
		<Card.Description>
			Things jjb says without thinking. Leave a box empty to use her default (shown faded).
		</Card.Description>
		<Card.Action>
			<Button onclick={save} disabled={submitting}>
				<SaveIcon />
				Save
			</Button>
		</Card.Action>
	</Card.Header>
	<Card.Content class="grid gap-6 md:grid-cols-2">
		{#each lists as list (list.id)}
			<Field.Field>
				<div class="flex items-center justify-between gap-2">
					<Field.Label for={`jjb-${list.id}`}>{list.label}</Field.Label>
					<Button variant="ghost" size="sm" onclick={() => setList(list.id, '')} disabled={submitting}>
						<RotateCcwIcon />
						Default
					</Button>
				</div>
				<textarea
					id={`jjb-${list.id}`}
					class="min-h-28 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
					placeholder={toText(list.defaults)}
					value={values[list.id]()}
					oninput={(event) => setList(list.id, event.currentTarget.value)}
					disabled={submitting}
				></textarea>
				<Field.Description>{list.help} One line each.</Field.Description>
			</Field.Field>
		{/each}

		<Field.Field>
			<div class="flex items-center justify-between gap-2">
				<Field.Label for="jjb-fallback">Fallback reply</Field.Label>
				<Button variant="ghost" size="sm" onclick={() => (fallback = '')} disabled={submitting}>
					<RotateCcwIcon />
					Default
				</Button>
			</div>
			<input
				id="jjb-fallback"
				class="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
				maxlength={PERSONALITY_LIMITS.fallback}
				placeholder={CHAT_FALLBACK}
				bind:value={fallback}
				disabled={submitting}
			/>
			<Field.Description>Said when her reply comes back empty or broken.</Field.Description>
		</Field.Field>

		<Field.Field class="md:col-span-2">
			<div class="flex items-center justify-between gap-2">
				<label class="flex items-center gap-2 text-sm font-medium">
					<input type="checkbox" class="checkbox checkbox-sm" bind:checked={memeEnabled} disabled={submitting} />
					“gg fkin ez” bit
				</label>
				<Button variant="ghost" size="sm" onclick={() => (memePrompt = '')} disabled={submitting}>
					<RotateCcwIcon />
					Default
				</Button>
			</div>
			<textarea
				class="min-h-20 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
				maxlength={PERSONALITY_LIMITS.meme}
				placeholder={MEME_PROMPT}
				bind:value={memePrompt}
				disabled={submitting || !memeEnabled}
			></textarea>
			<Field.Description>The instruction for her meme bit. Untick to turn it off in this server.</Field.Description>
		</Field.Field>

		<div class="flex flex-col gap-3 md:col-span-2">
			<div class="flex items-center justify-between gap-2">
				<div>
					<p class="text-sm font-semibold">“DeepSeek is down” storylines</p>
					<p class="text-sm text-muted-foreground">
						When her brain is offline she plays one storyline, escalating a stage each time she’s pinged.
						Separate stages with a line containing only <code>---</code>. Empty means her default storylines.
					</p>
				</div>
				<div class="flex gap-2">
					<Button variant="outline" size="sm" onclick={useDefaultScenarios} disabled={submitting}>Edit defaults</Button>
					<Button variant="ghost" size="sm" onclick={() => (scenarios = [])} disabled={submitting}>
						<RotateCcwIcon />
						Default
					</Button>
				</div>
			</div>
			{#each scenarios as scenario, index (index)}
				<div class="flex flex-col gap-2 rounded-lg border p-3">
					<div class="flex items-center gap-2">
						<input
							class="w-48 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm dark:bg-input/30"
							placeholder="storyline name"
							maxlength={40}
							bind:value={scenario.name}
							disabled={submitting}
						/>
						<Button
							variant="ghost"
							size="sm"
							onclick={() => (scenarios = scenarios.filter((_, i) => i !== index))}
							disabled={submitting}
						>
							Remove
						</Button>
					</div>
					<textarea
						class="min-h-32 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 font-mono text-xs outline-none focus-visible:border-ring dark:bg-input/30"
						bind:value={scenario.text}
						disabled={submitting}
					></textarea>
				</div>
			{/each}
			{#if scenarios.length < PERSONALITY_LIMITS.downScenarios}
				<Button
					variant="outline"
					size="sm"
					class="self-start"
					onclick={() => (scenarios = [...scenarios, { name: '', text: '' }])}
					disabled={submitting}
				>
					Add storyline
				</Button>
			{/if}
		</div>
	</Card.Content>
</Card.Root>
