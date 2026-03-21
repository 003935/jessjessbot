<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

{#if data !== null}
	<p>Logged in</p>
	<button
		onclick={() => {
			authClient.signOut();
		}}
	>
		Logout
	</button>
	{#if data.eventGames.length === 0}
		<div>No games added</div>
	{/if}
	{#each data.eventGames as eventGame (eventGame.guildId + eventGame.roleId)}
		<div>{eventGame.name} - {eventGame.roleId} - {eventGame.guildId}</div>
	{/each}

	<div class="card w-96 bg-neutral card-border">
		<div class="card-body">
			<h2 class="card-title">Add a New Game</h2>
			<form method="POST" action="?/addEventGame">
				<fieldset class="fieldset">
					<legend class="fieldset-legend">Server</legend><select
						class="select"
						name="guildId"
						aria-placeholder="test"
					>
						{#each data.servers as server (server.id)}
							<option value={server.id}>{server.name}</option>
						{/each}
					</select>
				</fieldset>
				<fieldset class="fieldset">
					<legend class="fieldset-legend">Game Name</legend>
					<input class="input" type="string" placeholder="Game Name" name="gameId" />
				</fieldset>
				<fieldset class="fieldset">
					<legend class="fieldset-legend">Role Id</legend>
					<input class="input" type="string" placeholder="Role Id" name="roleId" />
				</fieldset>
				<div class="mt-4 card-actions w-full justify-center">
					<input class="btn w-full btn-primary" type="submit" title="Add" />
				</div>
			</form>
		</div>
	</div>
{:else}
	<p>Not logged in</p>
	<button
		onclick={() => {
			authClient.signIn.social({
				provider: 'discord'
			});
		}}
	>
		Login
	</button>
{/if}
