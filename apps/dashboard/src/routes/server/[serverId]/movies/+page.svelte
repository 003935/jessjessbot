<script lang="ts">
	import type { PageProps } from './$types';
	import * as Card from '$lib/components/ui/card/index.js';
	import { add_request, getServerMovies, remove_request } from '$lib/movie.remote';
	import * as Avatar from '$lib/components/ui/avatar/index.js';
	import * as Pagination from '$lib/components/ui/pagination/index.js';
	import Button from '$lib/components/ui/button/button.svelte';
	import { ThumbsUpIcon, XIcon } from '@lucide/svelte';

	let { data }: PageProps = $props();

	let page = $state(1);

	const avatar_display_limit = 3;
	const page_limit = 10;

	const movie_query = $derived(getServerMovies({ limit: page_limit, page }));

	let requested_movies = $derived.by(() => {
		if (!movie_query.ready) return;
		const new_req_movies: number[] = [];
		movie_query.current.movies.forEach((m) => {
			if (m.requests.some((r) => r.id === data.discordId)) new_req_movies.push(m.tmdbId);
		});
		return new_req_movies;
	});

	function description(movie: NonNullable<(typeof movie_query)['current']>['movies'][number]) {
		let items = new Array<string>();
		if (movie.release_date) items.push(new Date(movie.release_date).getFullYear().toString());

		if (movie.runtime) items.push(`${movie.runtime}m`);

		if (movie.imdbRating) items.push(`${movie.imdbRating} ★`);

		return items.join(' | ');
	}
</script>

<div class="container mx-auto max-w-7xl px-4 py-8">
	<div class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
		{#each (await movie_query).movies as movie (movie.tmdbId)}
			<Card.Root class="relative mx-auto w-full max-w-sm pt-0">
				<div class="inset absolute inset-1 z-30 flex h-fit justify-end">
					<div class="flex -space-x-2 rounded-xl bg-accent/95 px-0.5 py-0.5 ring-1 ring-accent">
						{#each movie.requests.slice(0, avatar_display_limit) as request (movie.tmdbId + request.id)}
							<Avatar.Root class="size-6">
								<Avatar.Image src={request.avatar} alt="" />
								<Avatar.Fallback>{request.name.charAt(0).toUpperCase()}</Avatar.Fallback>
							</Avatar.Root>
						{/each}
						{#if movie.requests.length > avatar_display_limit}
							<Avatar.Root class="size-6">
								<Avatar.Fallback>+{movie.requests.length - avatar_display_limit}</Avatar.Fallback>
							</Avatar.Root>
						{/if}
					</div>
				</div>
				<img
					src={`https://image.tmdb.org/t/p/w300${movie.poster_path}`}
					alt=""
					class="relative z-20 h-87.5 w-full object-cover"
				/>
				<Card.Header>
					{#if requested_movies !== undefined}
						<Card.Action>
							{@const is_requested = requested_movies.some((id) => id === movie.tmdbId)}
							{#if is_requested}
								<Button
									size="icon-sm"
									variant="destructive"
									onclick={async () => {
										await remove_request(movie.tmdbId).updates(movie_query);
									}}
								>
									<XIcon />
								</Button>
							{:else}
								<Button
									size="icon-sm"
									variant="ghost"
									onclick={async () => {
										await add_request(movie.tmdbId).updates(movie_query);
									}}
								>
									<ThumbsUpIcon />
								</Button>
							{/if}
						</Card.Action>
					{/if}
					<Card.Title>{movie.title}</Card.Title>
					<Card.Description>
						{description(movie)}
					</Card.Description>
				</Card.Header>
			</Card.Root>
		{/each}
	</div>
	{#if movie_query.ready && movie_query.current.count > page_limit}
		<Pagination.Root count={movie_query.current.count} perPage={page_limit} bind:page>
			{#snippet children({ pages, currentPage })}
				<Pagination.Content>
					<Pagination.Item>
						<Pagination.Previous />
					</Pagination.Item>
					{#each pages as page (page.key)}
						{#if page.type === 'ellipsis'}
							<Pagination.Item>
								<Pagination.Ellipsis />
							</Pagination.Item>
						{:else}
							<Pagination.Item>
								<Pagination.Link {page} isActive={currentPage === page.value}>
									{page.value}
								</Pagination.Link>
							</Pagination.Item>
						{/if}
					{/each}
					<Pagination.Item>
						<Pagination.Next />
					</Pagination.Item>
				</Pagination.Content>
			{/snippet}
		</Pagination.Root>
	{/if}
</div>
