import { LolApi } from 'twisted';
import { RIOT_API_KEY } from '@/environment';
import { Regions, Tiers } from 'twisted/dist/constants';
import { db } from '@/db';

const lolApi = new LolApi({ key: RIOT_API_KEY });

async function rank_update() {
	const accounts = await db.league_table.getAllAccounts();
	for (const account of accounts) {
		const leagueData = await lolApi.League.byPUUID(account.riot_puuid, account.region as Regions);
		const league_soloq = leagueData.response.find(
			(league_data) => league_data.queueType === 'RANKED_SOLO_5x5'
		);
		db.league_table.updateAccount(
			account.riot_puuid,
			league_soloq
				? {
						soloq: {
							lp: league_soloq.leaguePoints,
							wins: league_soloq.wins,
							rank: league_soloq.rank,
							tier: league_soloq.tier as Tiers,
						},
					}
				: null
		);
		await new Promise((resolve, reject) => setTimeout(resolve, 5000));
	}
}

export function start_background_rank_update() {
	rank_update();

	setInterval(rank_update, 1000 * 60 * 60);
}
