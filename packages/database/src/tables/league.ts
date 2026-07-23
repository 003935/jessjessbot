import { Constants } from 'twisted';
import { DatabaseConnection } from '../connection';
import type { LeagueAccount, Region } from '../generated/prisma/client';
import { Prisma } from '../generated/prisma/client';

export function romanToNumeral(roman: string) {
	let accumulator = 0;
	for (let i = 0; i < roman.length; i++) {
		if (roman[i] === 'I' && roman[i + 1] === 'V') {
			accumulator += 4;
			i++;
		} else if (roman[i] === 'I') accumulator += 1;
	}
	return accumulator;
}

type Tier = (typeof Constants.Tiers)[keyof typeof Constants.Tiers];

const TiersSorted: Tier[] = [
	Constants.Tiers.IRON,
	Constants.Tiers.BRONZE,
	Constants.Tiers.SILVER,
	Constants.Tiers.GOLD,
	Constants.Tiers.PLATINUM,
	Constants.Tiers.EMERALD,
	Constants.Tiers.DIAMOND,
	Constants.Tiers.MASTER,
	Constants.Tiers.GRANDMASTER,
	Constants.Tiers.CHALLENGER,
];

type LeagueData = {
	soloq?: {
		wins: number;
		rank: string;
		tier: Tier;
		lp: number;
	};
};

export class LeagueTable extends DatabaseConnection {
	constructor(db_conn: DatabaseConnection) {
		super(db_conn);
	}

	async size(): Promise<number> {
		return await this._db.leagueAccount.count();
	}

	async getAccounts(id: string): Promise<LeagueAccount[]> {
		const users = await this._db.leagueAccount.findMany({
			where: { discordId: id },
		});
		return users;
	}

	async getAllAccounts(): Promise<LeagueAccount[]> {
		const users = await this._db.leagueAccount.findMany();
		return users;
	}

	async insertAccount(account: {
		discordId: string;
		riotPuuid: string;
		riotGamename?: string | null;
		riotTagline?: string | null;
		region: Region;
		leaguedata?: LeagueData | null;
		tftdata?: LeagueData | null;
	}) {
		const data: Prisma.LeagueAccountCreateInput = {
			discordId: account.discordId,
			riotPuuid: account.riotPuuid,
			region: account.region,
		};

		if (account.riotGamename !== undefined) data.riotGamename = account.riotGamename;
		if (account.riotTagline !== undefined) data.riotTagline = account.riotTagline;
		if (account.leaguedata !== undefined && account.leaguedata !== null)
			data.leaguedata = account.leaguedata;
		if (account.tftdata !== undefined && account.tftdata !== null) data.tftdata = account.tftdata;

		await this._db.leagueAccount.create({ data });
	}

	async updateAccount(id: string, league_data: LeagueData | null): Promise<void> {
		await this._db.leagueAccount.update({
			where: { riotPuuid: id },
			data: {
				leaguedata: league_data !== null ? league_data : Prisma.DbNull,
			},
		});
	}

	async leaderboard(limit: number = 7) {
		const users = await this._db.leagueAccount.findMany();
		const [ranked, unranked] = users.reduce<[LeagueAccount[], LeagueAccount[]]>(
			([ranked, unranked], user) => {
				const soloq = user.leaguedata?.soloq;
				if (soloq !== undefined) {
					ranked.push(user);
				} else {
					unranked.push(user);
				}
				return [ranked, unranked];
			},
			[[], []]
		);

		const sorted = ranked.sort((a, b) => {
			const asoloq = a.leaguedata?.soloq;
			const bsoloq = b.leaguedata?.soloq;

			if (!asoloq || !bsoloq) return 0;

			const aTierIndexOf = TiersSorted.indexOf(asoloq.tier as Tier);
			const bTierIndexOf = TiersSorted.indexOf(bsoloq.tier as Tier);
			if (aTierIndexOf !== bTierIndexOf) {
				return bTierIndexOf > aTierIndexOf ? 1 : -1;
			}

			const aRank = romanToNumeral(asoloq.rank);
			const bRank = romanToNumeral(bsoloq.rank);

			if (aRank !== bRank) {
				return bRank > aRank ? -1 : 1;
			}

			return bsoloq.lp > asoloq.lp ? 1 : -1;
		});

		return [...sorted, ...unranked].slice(0, limit);
	}
}
