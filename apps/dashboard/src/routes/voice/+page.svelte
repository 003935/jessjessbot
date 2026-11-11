<script lang="ts">
	import type { PageProps } from './$types';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { PencilIcon, RotateCcwIcon, SaveIcon } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { editVoice } from '$lib/voice.remote';
	import { PERSONALITY_DEFAULT, PERSONALITY_LIMITS } from '@repo/database/defaults';

	let { data }: PageProps = $props();

	// svelte-ignore state_referenced_locally
	let personality = $state(data.voice.personality);
	// svelte-ignore state_referenced_locally
	let saved = $state(data.voice.personality);
	// svelte-ignore state_referenced_locally
	let savedAt = $state(data.voice.updatedAt);
	let submitting = $state(false);
	let textarea = $state<HTMLTextAreaElement>();

	const usingDefault = $derived(!personality.trim());
	const dirty = $derived(personality.trim() !== saved.trim());
	const limit = PERSONALITY_LIMITS.personality;

	async function save() {
		if (!dirty || submitting) return;
		submitting = true;
		try {
			await editVoice({ personality });
			saved = personality;
			savedAt = new Date().toISOString();
			toast.success('Saved. Every server gets it within a minute.');
		} catch {
			toast.error(`Could not save. Keep it under ${limit} characters.`);
		} finally {
			submitting = false;
		}
	}

	function editDefault() {
		personality = PERSONALITY_DEFAULT;
		textarea?.focus();
	}

	function onkeydown(event: KeyboardEvent) {
		if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
			event.preventDefault();
			void save();
		}
	}

	function onbeforeunload(event: BeforeUnloadEvent) {
		if (dirty) event.preventDefault();
	}
</script>

<svelte:window {onkeydown} {onbeforeunload} />

<div class="container mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
	<div class="flex flex-wrap items-end justify-between gap-4">
		<div class="flex flex-col gap-1">
			<h1 class="text-2xl font-bold">jjb’s personality</h1>
			<p class="max-w-2xl text-sm text-muted-foreground">
				Who she is and how she talks, in every server. Tool and safety rules stay in code and are
				always added after this.
			</p>
		</div>
		<div class="flex items-center gap-3">
			<span class="text-sm text-muted-foreground">
				{#if dirty}
					Unsaved changes
				{:else if savedAt}
					Saved {new Date(savedAt).toLocaleString()}
				{/if}
			</span>
			<Button onclick={save} disabled={!dirty || submitting}>
				<SaveIcon />
				{submitting ? 'Saving…' : 'Save'}
			</Button>
		</div>
	</div>

	<Card.Root class="gap-0 py-0">
		<div class="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
			<div class="flex items-center gap-2 text-sm">
				<span
					class="size-2 rounded-full {usingDefault ? 'bg-muted-foreground' : 'bg-primary'}"
					aria-hidden="true"
				></span>
				{#if usingDefault}
					<span class="font-medium">Using her default</span>
					<span class="text-muted-foreground">shown faded below</span>
				{:else}
					<span class="font-medium">Custom personality</span>
				{/if}
			</div>
			{#if usingDefault}
				<Button variant="outline" size="sm" onclick={editDefault} disabled={submitting}>
					<PencilIcon />
					Edit the default
				</Button>
			{:else}
				<Button variant="ghost" size="sm" onclick={() => (personality = '')} disabled={submitting}>
					<RotateCcwIcon />
					Go back to default
				</Button>
			{/if}
		</div>
		<label for="voice-personality" class="sr-only">Personality</label>
		<textarea
			id="voice-personality"
			bind:this={textarea}
			class="h-[calc(100vh-20rem)] min-h-96 w-full resize-y bg-transparent px-4 py-4 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/60 disabled:opacity-50"
			maxlength={limit}
			placeholder={PERSONALITY_DEFAULT}
			bind:value={personality}
			disabled={submitting}
		></textarea>
		<div
			class="flex items-center justify-between gap-3 border-t px-4 py-2 text-xs text-muted-foreground"
		>
			<span>Ctrl+S to save</span>
			<span class:text-destructive={personality.length > limit * 0.95}>
				{(usingDefault ? PERSONALITY_DEFAULT : personality).length.toLocaleString()} / {limit.toLocaleString()}
				characters
			</span>
		</div>
	</Card.Root>
</div>
