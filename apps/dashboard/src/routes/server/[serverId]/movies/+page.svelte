<script lang="ts">
	import type { PageProps } from './$types';
	import * as Card from '$lib/components/ui/card/index.js';
	import { getServerMovies } from '$lib/movie.remote';
	import * as Avatar from '$lib/components/ui/avatar/index.js';
	import * as Pagination from '$lib/components/ui/pagination/index.js';

	let { data }: PageProps = $props();

	let page = $state(1);

	const avatar_display_limit = 3;
	const page_limit = 10;

	const movie_query = $derived(getServerMovies({ limit: page_limit, page }));
</script>

<div class="container mx-auto max-w-7xl px-4 py-8">
	<div class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
		{#each (await movie_query).movies as movie (movie.imdbId)}
			<Card.Root class="relative mx-auto w-full max-w-sm pt-0">
				<img
					src={movie.poster}
					alt="Event cover"
					class="relative z-20 h-87.5 w-full object-cover"
				/>
				<Card.Header>
					<Card.Action>
						<div class="flex -space-x-2">
							{#each movie.requests.slice(0, avatar_display_limit) as request (movie.imdbId + request.id)}
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
					</Card.Action>
					<Card.Title>{movie.title}</Card.Title>
					<Card.Description>
						{movie.year} | {movie.runtime} | {movie.imdbRating} ★
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
