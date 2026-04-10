<script lang="ts">
	import {
		getFailedMentions,
		hideFailedMention,
		identifyFailedMention,
	} from '$lib/failedMentions.remote';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import Eye from '@lucide/svelte/icons/eye';
	import UserCheck from '@lucide/svelte/icons/user-check';
	import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
	import Crown from '@lucide/svelte/icons/crown';
	import { Score_To_String, FailedMentionStatus } from '@repo/database/utils';
	import { isHttpError } from '@sveltejs/kit';

	type FailedMention = {
		id: number;
		guildId: string;
		displayName: string;
		messageId: string;
		channelId: string;
		message_timestamp: Date;
		score: number;
		winner: boolean;
		status: FailedMentionStatus;
	};

	let { serverId }: { serverId: string } = $props();

	import { SvelteMap } from 'svelte/reactivity';

	const query = $derived(getFailedMentions(serverId));
	let failedMentions = $derived(query.current ?? []);
	let showHidden = $state(false);
	let isHiding = $state<number | null>(null);
	let isIdentifying = $state<number | null>(null);
	let identifyUserId = $state('');
	let identifyError = $state<string | null>(null);

	let filteredMentions = $derived(
		(failedMentions as FailedMention[]).filter((m) => showHidden || m.status !== 'IGNORED')
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
		isHiding = mention.id;
		try {
			await hideFailedMention({ mentionId: mention.id, guildId: serverId }).updates(
				getFailedMentions(serverId).withOverride((arr) =>
					arr?.map((m) => (m.id === mention.id ? { ...m, status: 'IGNORED' } : m))
				)
			);
		} catch (e) {
			console.error('Failed to hide mention:', e);
		} finally {
			isHiding = null;
		}
	}

	function openIdentifyDialog(mention: FailedMention) {
		isIdentifying = mention.id;
		identifyUserId = '';
		identifyError = null;
	}

	function closeIdentifyDialog() {
		isIdentifying = null;
		identifyUserId = '';
		identifyError = null;
	}

	async function handleIdentify() {
		if (!isIdentifying || !identifyUserId.trim()) {
			identifyError = 'Please enter a Discord user ID';
			return;
		}

		try {
			await identifyFailedMention({
				mentionId: isIdentifying,
				guildId: serverId,
				userId: identifyUserId.trim(),
			}).updates(
				getFailedMentions(serverId).withOverride((arr) =>
					arr?.filter((m) => m.id !== isIdentifying)
				)
			);
			closeIdentifyDialog();
		} catch (e) {
			identifyError = isHttpError(e) ? e.body.message : 'Failed to identify user';
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
			<div class="h-96 overflow-x-auto">
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
								<th>Actions</th>
							</tr>
						</thead>
						<tbody>
							{#each mentions as mention (mention.id)}
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
												disabled={isHiding === mention.id || mention.status === 'IGNORED'}
												type="button"
											>
												{#if isHiding === mention.id}
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
												onclick={() => openIdentifyDialog(mention)}
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
			</div>
		{/if}
	</div>
</div>

{#if isIdentifying !== null}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
		role="button"
		tabindex="0"
		onclick={closeIdentifyDialog}
		onkeydown={(e) => e.key === 'Escape' && closeIdentifyDialog()}
	>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="card w-96 bg-base-100 shadow-xl" onclick={(e) => e.stopPropagation()}>
			<div class="card-body">
				<h3 class="card-title">Identify Failed Mention</h3>
				<p class="text-sm text-base-content/60">
					Enter the Discord user ID to associate with this mention.
				</p>
				<label class="form-control w-full">
					<div class="label">
						<span class="label-text">Discord User ID</span>
					</div>
					<input
						type="text"
						placeholder="123456789012345678"
						class="input-bordered input w-full"
						bind:value={identifyUserId}
						onkeydown={(e) => e.key === 'Enter' && handleIdentify()}
					/>
				</label>
				{#if identifyError}
					<div class="alert py-2 alert-error">
						<AlertTriangle size={16} />
						<span class="text-sm">{identifyError}</span>
					</div>
				{/if}
				<div class="mt-4 card-actions justify-end">
					<button class="btn btn-ghost btn-sm" onclick={closeIdentifyDialog} type="button">
						Cancel
					</button>
					<button class="btn btn-sm btn-primary" onclick={handleIdentify} type="button">
						Identify
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
