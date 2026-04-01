<script lang="ts">
	import type { PageProps } from './$types';
	import { getGameRoles } from '$lib/gameRole.remote';
	import GameRoleDialog from '$lib/components/GameRoleDialog.svelte';
	import WordleImport from '$lib/components/WordleImport.svelte';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import Shield from '@lucide/svelte/icons/shield';
	import Plus from '@lucide/svelte/icons/plus';
	import AlertTriangle from '@lucide/svelte/icons/alert-triangle';

	let { data }: PageProps = $props();

	let dialog: GameRoleDialog;

	const query = $derived(getGameRoles(data.guild.id));
</script>

<div class="min-h-screen bg-gradient-to-br from-base-300/30 via-base-200/30 to-base-100">
	<div class="container mx-auto px-4 py-8">
		<div class="card mb-8 border border-base-300 bg-base-100 shadow-xl">
			<div class="card-body">
				<div class="flex items-center gap-6">
					<div class="avatar">
						<div class="mask w-20 rounded-2xl mask-squircle shadow-lg ring-2 ring-primary/30">
							{#if data.guild?.icon}
								<img src={data.guild.icon} alt="" />
							{/if}
						</div>
					</div>
					<div>
						<h1
							class="bg-gradient-to-r from-primary to-secondary bg-clip-text text-3xl font-bold text-transparent"
						>
							{data.guild.name}
						</h1>
						<p class="mt-1 text-sm text-base-content/60">Manage game roles and permissions</p>
					</div>
				</div>
			</div>
		</div>

		<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
			<div class="card bg-base-100 shadow-xl border border-base-300">
				<div class="card-body pt-6">
					<div class="flex items-center justify-between mb-4">
						<div class="flex items-center gap-3">
							<div class="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20">
								<Shield size={24} class="text-primary" />
							</div>
							<h2 class="card-title text-2xl">Game Roles</h2>
						</div>
						<button
							class="btn btn-sm btn-primary gap-2 rounded-xl shadow-lg hover:shadow-xl transition-all"
							onclick={() => dialog.open()}
						>
							<Plus size={18} />
							Add Event Game
						</button>
					</div>
					<div class="h-px bg-gradient-to-r from-primary/20 to-transparent mb-4"></div>
					{#if query.error}
						<div class="alert alert-error rounded-xl">
							<AlertTriangle size={24} />
							<span>Failed to load game roles</span>
						</div>
					{:else if query.loading}
						<div class="py-12 flex justify-center">
							<span class="loading loading-spinner loading-lg text-primary"></span>
						</div>
					{:else if query.current?.length === 0}
						<div class="text-center py-12 text-base-content/60">
							<div class="inline-flex p-4 rounded-full bg-base-200/50 mb-4">
								<Shield size={48} class="opacity-50" />
							</div>
							<p class="text-lg font-medium">No game roles configured yet</p>
							<p class="text-sm mt-2">Click "Add Event Game" to get started</p>
						</div>
					{:else}
						<div class="flex flex-col gap-2">
							{#each query.current as game_role (game_role.roleId + game_role.guildId + game_role.gameName)}
								{@const emoji = game_role.gameIcon
									? data.emojis.find((e) => e.id === game_role.gameIcon)
									: null}
								<div
									class="flex items-center justify-between gap-4 rounded-xl bg-base-200/50 p-4 transition-all hover:bg-base-200"
								>
									<div class="flex items-center gap-4">
										{#if emoji}
											<div class="avatar">
												<div class="w-10 rounded-lg shadow-sm">
													<img
														src={`https://cdn.discordapp.com/emojis/${emoji.id}.webp?size=96&quality=lossless${emoji.animated ? '&animated=true' : ''}`}
														alt=""
													/>
												</div>
											</div>
										{:else}
											<div
												class="w-10 h-10 rounded-lg bg-base-300 flex items-center justify-center text-base-content/40"
											>
												<Shield size={24} />
											</div>
										{/if}
										<span class="font-semibold">{game_role.gameName}</span>
									</div>
									<div class="flex items-center gap-3">
										{#if game_role.role}
											<div
												class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20"
											>
												<span class="h-2 w-2 rounded-full bg-primary"></span>
												<span class="text-sm font-medium text-primary">
													{game_role.role.name}
												</span>
											</div>
										{:else}
											<div
												class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-error/10 border border-error/20"
											>
												<AlertTriangle size={14} class="text-error" />
												<span class="text-sm font-medium text-error">
													Role {game_role.roleId} not found
												</span>
											</div>
										{/if}
										<button
											class="btn btn-ghost btn-sm btn-square text-base-content/60 hover:text-primary hover:bg-primary/10 transition-all rounded-lg"
											onclick={() => {
												dialog.open(game_role);
											}}
										>
											<PencilIcon size={18} />
										</button>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>

			<WordleImport serverId={data.guild.id} wordleImport={data.wordleImport} />
		</div>
	</div>
</div>

<GameRoleDialog
	bind:this={dialog}
	games={data.games}
	roles={data.guild.roles}
	guildId={data.guild.id}
/>
