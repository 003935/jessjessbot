<script>
	import { authClient } from '$lib/auth-client';

	let session = authClient.useSession();
</script>

<h1>Welcome to SvelteKit</h1>
<p>Visit <a href="https://svelte.dev/docs/kit">svelte.dev/docs/kit</a> to read the documentation</p>

{#if $session.data?.user}
	<p>Logged in</p>
	<button
		onclick={() => {
			authClient.signOut();
		}}
	>
		Logout
	</button>
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
