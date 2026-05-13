<script lang="ts">
	import {
		getFailedMentions,
		hideFailedMention,
		type FailedMentionId,
	} from '$lib/failedMentions.remote';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import Eye from '@lucide/svelte/icons/eye';
	import UserCheck from '@lucide/svelte/icons/user-check';
	import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
	import Crown from '@lucide/svelte/icons/crown';

	import { SvelteMap } from 'svelte/reactivity';
	import { Score_To_String } from '$lib';
	import IdentifyDialog from './IdentifyDialog.svelte';

	let { serverId }: { serverId: string } = $props();

	type FailedMention = NonNullable<ReturnType<typeof getFailedMentions>['current']>[number];

	const query = $derived(getFailedMentions(serverId));
	let failedMentions = $derived(query.current ?? []);
	let showHidden = $state(false);
	let isHiding = $state<FailedMentionId | null>(null);
	let identifySingle = $state<FailedMentionId | null>(null);
	let identifyBulk = $state<string | null>(null);

	function isSameMention(a: FailedMentionId, b: FailedMentionId): boolean {
		return (
			a.channelId === b.channelId &&
			a.messageId === b.messageId &&
			a.startOfMention === b.startOfMention
		);
	}

	let filteredMentions = $derived(
		failedMentions.filter((m) => showHidden || m.status !== 'IGNORED')
	);

	function getGroupedMentions() {
		const groups = new SvelteMap<string, FailedMention[]>();

		for (const mention of filteredMentions) {
			const key = mention.displayName;
			if (!groups.has(key)) {
				groups.set(key, []);
			}
			groups.get(key)!.push(mention);
		}

		return groups;
	}

	async function handleHide(mention: FailedMention) {
		const id = {
			channelId: mention.channelId,
			messageId: mention.messageId,
			startOfMention: mention.startOfMention,
		};
		isHiding = id;
		try {
			await hideFailedMention({ mentionId: id, guildId: serverId }).updates(
				getFailedMentions(serverId).withOverride((arr) =>
					arr?.map((m) => (isSameMention(m, id) ? { ...m, status: 'IGNORED' } : m))
				)
			);
		} catch (e) {
			console.error('Failed to hide mention:', e);
		} finally {
			isHiding = null;
		}
	}

	function formatScore(score: number) {
		const scoreStr = Score_To_String(score);
		return scoreStr === 'DNF' ? 'DNF' : `${scoreStr}/6`;
	}

	function formatDate(date: Date) {
		return new Date(date).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
		});
	}
</script>

<div
	class="animate-in fade-in slide-in-from-bottom-4 card border border-base-300/50 bg-base-100 shadow-lg delay-300 duration-500"
>
	<div class="card-body">
		<div class="mb-2 flex items-center justify-between">
			<div class="flex items-center gap-3">
				<div class="rounded-xl bg-linear-to-br from-warning/20 to-error/20 p-2">
					<AlertTriangle size={22} class="text-warning" />
				</div>
				<div>
					<h3 class="card-title text-xl">Failed Mentions</h3>
					<p class="text-xs text-base-content/50">
						{filteredMentions.length} unresolved mention{filteredMentions.length !== 1 ? 's' : ''}
					</p>
				</div>
			</div>
			<label class="label cursor-pointer gap-2">
				<span class="label-text text-xs">Show hidden</span>
				<input type="checkbox" class="toggle toggle-primary toggle-sm" bind:checked={showHidden} />
			</label>
		</div>
		<div class="mb-3 h-px bg-linear-to-r from-warning/20 to-transparent"></div>

		<div class="h-96 overflow-x-auto">
			{#if query.error}
				<div class="alert rounded-xl alert-error">
					<AlertTriangle size={20} />
					<span>Failed to load failed mentions</span>
				</div>
			{:else if query.loading}
				<div class="flex flex-col gap-3 py-8">
					<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
					{#each Array(3) as _, i (i)}
						<div
							class="flex animate-pulse items-center justify-between gap-4 rounded-xl bg-base-200/50 p-3"
						>
							<div class="flex items-center gap-4">
								<div class="h-10 w-10 rounded-lg bg-base-300"></div>
								<div class="h-4 w-20 rounded bg-base-300"></div>
							</div>
							<div class="h-6 w-24 rounded bg-base-300"></div>
						</div>
					{/each}
				</div>
			{:else if filteredMentions.length === 0}
				<div class="py-10 text-center text-base-content/60">
					<div class="mx-auto mb-4 inline-flex rounded-full bg-base-200/50 p-4">
						<AlertTriangle size={40} class="opacity-40" />
					</div>
					<p class="text-base font-medium">No unresolved failed mentions</p>
					<p class="mt-1.5 text-sm">All mentions have been resolved or hidden</p>
				</div>
			{:else}
				<table class="table-pin-rows table bg-base-200">
					{#each getGroupedMentions() as [displayName, mentions] (displayName)}
						<thead>
							<tr>
								<th>
									@{displayName} · {mentions.length} mention{mentions.length !== 1 ? 's' : ''}
								</th>
								<th>Score</th>
								<th>Winner</th>
								<th>Date</th>
								<th>
									{#if mentions.length > 1}
										<button
											class="btn gap-1 btn-xs btn-primary"
											onclick={() => (identifyBulk = displayName)}
											type="button"
										>
											<UserCheck size={12} />
											Identify All
										</button>
									{/if}
								</th>
							</tr>
						</thead>
						<tbody>
							{#each mentions as mention (mention.channelId + mention.messageId + mention.startOfMention)}
								<tr class:opacity-50={mention.status === 'IGNORED'}>
									<td>
										<span class="font-mono text-sm">@{mention.displayName}</span>
									</td>
									<td>
										<span class="badge badge-outline badge-sm">
											{formatScore(mention.score)}
										</span>
									</td>
									<td>
										{#if mention.winner}
											<span class="badge gap-1 badge-sm badge-success">
												<Crown size={12} />
												Yes
											</span>
										{:else}
											<span class="badge badge-ghost badge-sm">No</span>
										{/if}
									</td>
									<td class="text-base-content/60">
										{formatDate(mention.message_timestamp)}
									</td>
									<td>
										<div class="flex items-center gap-2">
											<button
												class="btn gap-1 btn-ghost btn-xs"
												onclick={() => handleHide(mention)}
												disabled={(isHiding !== null && isSameMention(isHiding, mention)) ||
													mention.status === 'IGNORED'}
												type="button"
											>
												{#if isHiding && isSameMention(isHiding, mention)}
													<span class="loading loading-xs loading-spinner"></span>
												{:else if mention.status === 'IGNORED'}
													<Eye size={14} />
													Hidden
												{:else}
													<EyeOff size={14} />
													Hide
												{/if}
											</button>
											<button
												class="btn gap-1 text-primary btn-ghost btn-xs"
												onclick={() =>
													(identifySingle = {
														channelId: mention.channelId,
														messageId: mention.messageId,
														startOfMention: mention.startOfMention,
													})}
												type="button"
											>
												<UserCheck size={14} />
												Identify
											</button>
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					{/each}
				</table>
			{/if}
		</div>
	</div>
</div>

{#if identifySingle !== null || identifyBulk !== null}
	<IdentifyDialog
		{serverId}
		{query}
		singleMention={identifySingle}
		bulkDisplayName={identifyBulk}
		onClose={() => {
			identifySingle = null;
			identifyBulk = null;
		}}
	/>
{/if}
