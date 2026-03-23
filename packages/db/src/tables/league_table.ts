import { type InferSelectModel, eq, type InferInsertModel } from 'drizzle-orm';
import { Constants } from 'twisted';
import { type Tiers } from 'twisted/dist/constants';
import { leagueTable } from '../schema';
import { DatabaseConnection } from '../connection';

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

type User = InferSelectModel<typeof leagueTable>;
type InsertUser = InferInsertModel<typeof leagueTable>;

const TiersSorted = [
  Constants.Tiers.IRON,
  Constants.Tiers.BRONZE,
  Constants.Tiers.SILVER,
  Constants.Tiers.GOLD,
  Constants.Tiers.PLATINUM,
  Constants.Tiers.EMERALD,
  Constants.Tiers.DIAMOND,
  Constants.Tiers.MASTER,
  Constants.Tiers.GRANDMASTER,
  Constants.Tiers.CHALLENGER
];

export class LeagueTable extends DatabaseConnection {
  constructor(db_conn: DatabaseConnection) {
    super(db_conn);
  }

  async size(): Promise<number> {
    return await this._db.$count(leagueTable);
  }

  async getAccounts(id: string): Promise<User[]> {
    const users = await this._db.select().from(leagueTable).where(eq(leagueTable.discordId, id));
    return users;
  }

  async getAllAccounts(): Promise<User[]> {
    const users = await this._db.select().from(leagueTable);
    return users;
  }

  async insertAccount(account: InsertUser) {
    await this._db.insert(leagueTable).values(account);
  }

  async updateAccount(id: string, league_data: InsertUser['leaguedata']): Promise<void> {
    await this._db
      .update(leagueTable)
      .set({ leaguedata: league_data })
      .where(eq(leagueTable.riot_puuid, id));
  }

  async leaderboard(limit: number = 7) {
    const users = await this._db.select().from(leagueTable);
    const ranked = users.filter((u) => u.leaguedata !== null && u.leaguedata.soloq !== undefined);
    const unranked = users.filter((u) => u.leaguedata === null || u.leaguedata.soloq === undefined);

    const sorted = ranked.sort((a, b) => {
      const asoloq = a.leaguedata!.soloq!;
      const bsoloq = b.leaguedata!.soloq!;
      const aTierIndexOf = TiersSorted.indexOf(asoloq.tier as Tiers);
      const bTierIndexOf = TiersSorted.indexOf(bsoloq.tier as Tiers);
      if (aTierIndexOf !== bTierIndexOf) {
        return bTierIndexOf > aTierIndexOf ? 1 : -1;
      }

      const aRank = romanToNumeral(asoloq.rank);
      const bRank = romanToNumeral(bsoloq.rank);
      console.log(
        `Comparing ${a.riot_gamename} (${asoloq.tier} ${asoloq.rank} ${asoloq.lp}LP) with ${b.riot_gamename} (${bsoloq.tier} ${bsoloq.rank} ${bsoloq.lp}LP)`
      );

      if (aRank !== bRank) {
        return bRank > aRank ? -1 : 1;
      }

      return bsoloq.lp > asoloq.lp ? 1 : -1;
    });

    return [...sorted, ...unranked].slice(0, limit);
  }
}
