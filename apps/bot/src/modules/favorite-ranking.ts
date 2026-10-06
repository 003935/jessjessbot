export type FavoriteCandidate = { userId: string; score: number; interactionCount: number };

export function rankFavorites(
	candidates: FavoriteCandidate[],
	recentUserIds: ReadonlySet<string>,
	currentUserId: string
): FavoriteCandidate[] {
	const weight = (candidate: FavoriteCandidate): number =>
		candidate.score * 2.5 +
		Math.min(4, Math.log2(candidate.interactionCount + 1)) +
		(recentUserIds.has(candidate.userId) ? 1.5 : 0) +
		(candidate.userId === currentUserId ? 0.25 : 0);
	return [...candidates].sort((a, b) => weight(b) - weight(a) || a.userId.localeCompare(b.userId));
}
