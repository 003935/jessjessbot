<script lang="ts">
	import {
		identifyFailedMention,
		identifyFailedMentionsByDisplayName,
		searchUsers,
		getFailedMentions,
		type FailedMentionId,
		type UserCandidate,
	} from '$lib/failedMentions.remote';
	import UserCheck from '@lucide/svelte/icons/user-check';
	import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
	import { isHttpError } from '@sveltejs/kit';
	import { toast } from 'svelte-sonner';

	let {
		serverId,
		query,
		singleMention,
		bulkDisplayName,
		onClose,
	}: {
		serverId: string;
		query: ReturnType<typeof getFailedMentions>;
		singleMention: FailedMentionId | null;
		bulkDisplayName: string | null;
		onClose: () => void;
	} = $props();

	let identifyUserId = $state('');
	let identifyError = $state<string | null>(null);
	let userCandidates = $state<UserCandidate[]>([]);
	let isSearchingUsers = $state(false);
	let selectedUserId = $state<string | null>(null);

	const isBulk = $derived(bulkDisplayName !== null);
	const title = $derived(isBulk ? `Identify All @${bulkDisplayName}` : 'Identify Failed Mention');
	const description = $derived(
		isBulk
			? `This will resolve all mentions with this display name to the specified Discord user.`
			: 'Select a matching user below, or enter a Discord user ID manually.'
	);

	$effect(() => {
		if (singleMention || bulkDisplayName) {
			loadCandidates();
		}
	});

	async function loadCandidates() {
		identifyUserId = '';
		identifyError = null;
		userCandidates = [];
		selectedUserId = null;

		const searchQuery = singleMention
			? (query.current?.find(
					(m) =>
						m.channelId === singleMention.channelId &&
						m.messageId === singleMention.messageId &&
						m.startOfMention === singleMention.startOfMention
				)?.displayName ?? '')
			: (bulkDisplayName ?? '');

		if (!searchQuery) return;

		isSearchingUsers = true;
		try {
			userCandidates = await searchUsers({
				guildId: serverId,
				query: searchQuery,
			});
		} catch (e) {
			console.error('Failed to search users:', e);
			userCandidates = [];
		} finally {
			isSearchingUsers = false;
		}
	}

	function selectUser(candidate: UserCandidate) {
		selectedUserId = candidate.id;
		identifyUserId = candidate.id;
	}

	async function handleSubmit() {
		if (!identifyUserId.trim()) {
			identifyError = 'Please enter a Discord user ID';
			return;
		}

		try {
			let result;
			if (isBulk && bulkDisplayName) {
				result = await identifyFailedMentionsByDisplayName({
					displayName: bulkDisplayName,
					guildId: serverId,
					userId: identifyUserId.trim(),
				});

				if (result.success && query.current) {
					query.set(query.current.filter((fm) => fm.displayName !== bulkDisplayName));
				} else {
					query.refresh();
				}
			} else if (singleMention) {
				result = await identifyFailedMention({
					mentionId: singleMention,
					guildId: serverId,
					userId: identifyUserId.trim(),
				});

				if (result.success && query.current) {
					const { channelId, messageId, startOfMention } = singleMention;
					query.set(
						query.current.filter(
							(fm) =>
								fm.channelId !== channelId ||
								fm.messageId !== messageId ||
								fm.startOfMention !== startOfMention
						)
					);
				} else {
					query.refresh();
				}
			}

			if (result?.success) {
				toast.success(result.message);
			} else if (result) {
				toast.error(result.message);
			}

			onClose();
		} catch (e) {
			identifyError = isHttpError(e) ? e.body.message : 'Failed to identify user';
		}
	}
</script>

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
	role="button"
	tabindex="0"
	onclick={onClose}
	onkeydown={(e) => e.key === 'Escape' && onClose()}
>
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="card max-h-[80vh] w-96 bg-base-100 shadow-xl" onclick={(e) => e.stopPropagation()}>
		<div class="card-body">
			<h3 class="card-title">{title}</h3>
			<p class="text-sm text-base-content/60">{description}</p>
			{#if isSearchingUsers}
				<div class="flex justify-center py-4">
					<span class="loading loading-md loading-spinner text-primary"></span>
				</div>
			{:else if userCandidates.length > 0}
				<div>
					<div class="mb-1 text-xs font-medium text-base-content/60">Matching users</div>
					<div class="max-h-48 overflow-y-auto">
						<ul class="menu w-full rounded-box bg-base-200">
							{#each userCandidates as candidate (candidate.id)}
								<li>
									<button
										type="button"
										class={selectedUserId === candidate.id
											? 'flex items-center gap-3 bg-primary/20 p-3'
											: 'flex items-center gap-3 p-3'}
										onclick={() => selectUser(candidate)}
									>
										<div class="avatar">
											<div class="w-8 rounded-full">
												{#if candidate.avatar}
													<img
														src="https://cdn.discordapp.com/avatars/{candidate.id}/{candidate.avatar}.webp?size=64"
														alt={candidate.displayName || candidate.username}
													/>
												{:else}
													<div
														class="flex h-full w-full items-center justify-center bg-neutral text-neutral-content"
													>
														{candidate.username.charAt(0).toUpperCase()}
													</div>
												{/if}
											</div>
										</div>
										<div class="flex-1 text-left">
											<div class="font-semibold">
												{candidate.displayName || candidate.username}
											</div>
											{#if candidate.displayName}
												<div class="text-xs opacity-60">@{candidate.username}</div>
											{/if}
										</div>
										{#if selectedUserId === candidate.id}
											<UserCheck size={16} class="text-primary" />
										{/if}
									</button>
								</li>
							{/each}
						</ul>
					</div>
				</div>
			{:else}
				<div class="py-2 text-center text-sm text-base-content/50">
					No matching users found for this display name
				</div>
			{/if}
			<label class="form-control w-full">
				<div class="label">
					<span class="label-text">Enter Discord User ID</span>
				</div>
				<input
					type="text"
					placeholder="123456789012345678"
					class="input-bordered input w-full"
					bind:value={identifyUserId}
					oninput={() => (selectedUserId = null)}
					onkeydown={(e) => e.key === 'Enter' && handleSubmit()}
				/>
			</label>
			{#if identifyError}
				<div class="alert py-2 alert-error">
					<AlertTriangle size={16} />
					<span class="text-sm">{identifyError}</span>
				</div>
			{/if}
			<div class="mt-4 card-actions justify-end">
				<button class="btn btn-ghost btn-sm" onclick={onClose} type="button">Cancel</button>
				<button
					class="btn btn-sm btn-primary"
					onclick={handleSubmit}
					type="button"
					disabled={!identifyUserId.trim()}
				>
					{isBulk ? 'Identify All' : 'Identify'}
				</button>
			</div>
		</div>
	</div>
</div>
