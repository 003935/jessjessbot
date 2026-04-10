import { LolApi } from 'twisted';
import { RIOT_API_KEY } from '@/environment';
import { Regions, Tiers } from 'twisted/dist/constants';
import { db } from '@/db';
import { sleep, Logger } from '@/utils';

const logger = new Logger('League');
const lolApi = new LolApi({ key: RIOT_API_KEY });

const DELAY_BETWEEN_ACCOUNTS_MS = 5000;
const RANK_UPDATE_INTERVAL_MS = 1000 * 60 * 60; // 1 hour

let is_updating = false;
let pending_update = false;

async function rank_update() {
	if (is_updating) {
		pending_update = true;
		logger.info('Rank update in progress, queued pending update');
		return;
	}

	is_updating = true;

	try {
		const accounts = await db.league.getAllAccounts();
		logger.info(`Starting rank update for ${accounts.length} accounts`);

		let successCount = 0;
		let failCount = 0;

		for (const account of accounts) {
			try {
				const leagueData = await lolApi.League.byPUUID(
					account.riotPuuid,
					account.region as Regions
				);

				if (!leagueData) {
					throw new Error('No league data found');
				}

				const league_soloq = leagueData.response.find(
					(league_data) => league_data.queueType === 'RANKED_SOLO_5x5'
				);

				await db.league.updateAccount(
					account.riotPuuid,
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

				successCount++;
			} catch (error) {
				failCount++;
				logger.error(`Unexpected error updating ${account.riotPuuid}`, error);
			} finally {
				await sleep(DELAY_BETWEEN_ACCOUNTS_MS);
			}
		}

		logger.info(`Rank update complete. Success: ${successCount}, Failed: ${failCount}`);
	} finally {
		is_updating = false;

		if (pending_update) {
			pending_update = false;
			logger.info('Running pending rank update');
			setImmediate(() => rank_update());
		}
	}
}

export function start_background_rank_update() {
	rank_update();
	setInterval(rank_update, RANK_UPDATE_INTERVAL_MS);
}
