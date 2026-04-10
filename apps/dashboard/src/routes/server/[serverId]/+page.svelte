<script lang="ts">
	import type { PageProps } from './$types';
	import { getGameRoles } from '$lib/gameRole.remote';
	import GameRoleDialog from '$lib/components/GameRoleDialog.svelte';
	import WordleImport from '$lib/components/WordleImport.svelte';
	import WordleSummary from '$lib/components/WordleSummary.svelte';
	import WordleScoreDist from '$lib/components/WordleScoreDist.svelte';
	import WordleLeaderboard from '$lib/components/WordleLeaderboard.svelte';
	import FailedMentionsTable from '$lib/components/FailedMentionsTable.svelte';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Shield from '@lucide/svelte/icons/shield';
	import Plus from '@lucide/svelte/icons/plus';
	import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Hash from '@lucide/svelte/icons/hash';
	import BarChart3 from '@lucide/svelte/icons/bar-chart-3';
	import Wrench from '@lucide/svelte/icons/wrench';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	let { data }: PageProps = $props();

	let dialog: GameRoleDialog | undefined = $state();

	const query = $derived(getGameRoles(data.guild.id));
</script>

<div class="min-h-screen bg-linear-to-br from-base-300/20 via-base-200/30 to-base-100">
	<div class="container mx-auto max-w-7xl px-4 py-8">
		<div class="animate-in fade-in slide-in-from-top-4 mb-6 duration-300">
			<button
				class="btn gap-2 rounded-lg text-base-content/70 btn-ghost btn-sm hover:text-base-content"
				onclick={() => goto(resolve('/'))}
			>
				<ArrowLeft size={16} />
				Back to home
			</button>
		</div>

		<section
			class="animate-in fade-in slide-in-from-bottom-4 card mb-8 border border-base-300/50 bg-base-100 shadow-lg duration-500"
		>
			<div class="card-body">
				<div class="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
					<div class="avatar shrink-0">
						<div class="mask w-20 rounded-2xl mask-squircle shadow-lg ring-2 ring-primary/30">
							{#if data.guild?.icon}
								<img src={data.guild.icon} alt="" />
							{:else}
								<div class="flex h-20 w-20 items-center justify-center bg-base-300">
									<Hash size={32} class="text-base-content/40" />
								</div>
							{/if}
						</div>
					</div>
					<div class="flex-1">
						<h1
							class="bg-linear-to-r from-primary to-secondary bg-clip-text text-3xl font-bold text-transparent"
						>
							{data.guild.name}
						</h1>
					</div>
				</div>
			</div>
		</section>

		{#if data.isAdmin}
			<section class="mb-8">
				<div class="mb-4 flex items-center gap-3">
					<div class="rounded-xl bg-linear-to-br from-primary/20 to-secondary/20 p-2">
						<Wrench size={22} class="text-primary" />
					</div>
					<h2 class="text-2xl font-bold">Management</h2>
				</div>

				<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
					<section
						class="animate-in fade-in slide-in-from-bottom-4 card border border-base-300/50 bg-base-100 shadow-lg delay-100 duration-500"
					>
						<div class="card-body pb-5">
							<div class="mb-2 flex items-center justify-between">
								<div class="flex items-center gap-3">
									<div class="rounded-xl bg-linear-to-br from-primary/20 to-secondary/20 p-2">
										<Shield size={22} class="text-primary" />
									</div>
									<div>
										<h3 class="card-title text-xl">Game Roles</h3>
										<p class="text-xs text-base-content/50">
											{#if query.loading}Loading...{:else if query.current}{query.current.length} configured{:else}0
												configured{/if}
										</p>
									</div>
								</div>
								<button
									class="btn gap-2 rounded-lg shadow-md transition-all btn-sm btn-primary hover:shadow-lg"
									onclick={() => dialog?.open()}
								>
									<Plus size={16} />
									Add Role
								</button>
							</div>
							<div class="mb-3 h-px bg-linear-to-r from-primary/20 to-transparent"></div>
							{#if query.error}
								<div class="alert rounded-xl alert-error">
									<AlertTriangle size={20} />
									<span>Failed to load game roles</span>
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
							{:else if query.current?.length === 0}
								<div class="py-10 text-center text-base-content/60">
									<div class="mx-auto mb-4 inline-flex rounded-full bg-base-200/50 p-4">
										<Shield size={40} class="opacity-40" />
									</div>
									<p class="text-base font-medium">No game roles configured yet</p>
									<p class="mt-1.5 text-sm">Click "Add Role" to get started</p>
								</div>
							{:else}
								<div class="flex max-h-[500px] flex-col gap-2 overflow-y-auto pr-1">
									{#each query.current as game_role (game_role.roleId + game_role.guildId + game_role.gameName)}
										{@const emoji = game_role.gameIcon
											? data.emojis.find((e) => e.id === game_role.gameIcon)
											: null}
										<div
											class="flex items-center justify-between gap-4 rounded-xl bg-base-200/40 p-3.5 transition-all hover:bg-base-200/70"
										>
											<div class="flex min-w-0 flex-1 items-center gap-3.5">
												{#if emoji}
													<div class="avatar shrink-0">
														<div class="h-10 w-10 rounded-lg shadow-sm">
															<img
																src={`https://cdn.discordapp.com/emojis/${emoji.id}.webp?size=96&quality=lossless${emoji.animated ? '&animated=true' : ''}`}
																alt=""
																loading="lazy"
															/>
														</div>
													</div>
												{:else}
													<div
														class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-base-300/50 text-base-content/40"
													>
														<Shield size={20} />
													</div>
												{/if}
												<span class="truncate font-semibold">{game_role.gameName}</span>
											</div>
											<div class="flex shrink-0 items-center gap-2.5">
												{#if game_role.role}
													<div
														class="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/10 px-3 py-1.5"
													>
														<span class="h-2 w-2 rounded-full bg-primary"></span>
														<span class="max-w-[120px] truncate text-sm font-medium text-primary">
															{game_role.role.name}
														</span>
													</div>
												{:else}
													<div
														class="flex items-center gap-2 rounded-lg border border-error/20 bg-error/10 px-3 py-1.5"
													>
														<AlertTriangle size={14} class="shrink-0 text-error" />
														<span class="text-sm font-medium text-error">Not found</span>
													</div>
												{/if}
												<button
													class="btn btn-square rounded-lg text-base-content/50 btn-ghost transition-all btn-sm hover:bg-primary/10 hover:text-primary"
													onclick={() => dialog?.open(game_role)}
												>
													<Pencil size={16} />
												</button>
											</div>
										</div>
									{/each}
								</div>
							{/if}
						</div>
					</section>

					<WordleImport serverId={data.guild.id} wordleImport={data.wordleImport} />
				</div>

				<div class="mt-6">
					<FailedMentionsTable serverId={data.guild.id} />
				</div>
			</section>
		{/if}

		<section>
			<div class="mb-4 flex items-center gap-3">
				<div class="rounded-xl bg-linear-to-br from-info/20 to-secondary/20 p-2">
					<BarChart3 size={22} class="text-info" />
				</div>
				<h2 class="text-2xl font-bold">Wordle Statistics</h2>
			</div>

			<div class="mb-6">
				<WordleSummary serverId={data.guild.id} />
			</div>

			<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
				<WordleScoreDist serverId={data.guild.id} />
				<WordleLeaderboard serverId={data.guild.id} />
			</div>
		</section>
	</div>
</div>

<GameRoleDialog
	bind:this={dialog}
	games={data.games}
	roles={data.guild.roles}
	guildId={data.guild.id}
/>
