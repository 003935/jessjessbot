import { Command } from '@sapphire/framework';
import { RIOT_API_KEY } from '@/environment';
import { MessageFlags } from 'discord.js';
import { LeagueTable } from '@repo/database';
import { LolApi, RiotApi, TftApi } from 'twisted';
import { Regions, regionToRegionGroupForAccountAPI, Tiers } from 'twisted/dist/constants';

const riotApi = new RiotApi({ key: RIOT_API_KEY });
const lolApi = new LolApi({ key: RIOT_API_KEY });
const tftApi = new TftApi({ key: RIOT_API_KEY });

export class AddLeagueAccountCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, { ...options });
  }

  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName('add')
        .setDescription('Add league account to leaderboard')
        .addStringOption((option) =>
          option.setName('game_id').setDescription('gamename#tagline').setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('region')
            .setDescription('account region')
            .setChoices(
              Object.entries(Regions)
                .filter(([_, val]) => [Regions.EU_WEST, Regions.AMERICA_NORTH].includes(val))
                .map(([id, val]) => ({
                  name: id,
                  value: val
                }))
            )
            .setRequired(true)
        )
    );
  }

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    const riotID = interaction.options.getString('game_id', true);
    const region = interaction.options.getString('region', true);

    const splitted = riotID.split('#').map((s) => s.trim());

    if (splitted.length !== 2 || splitted[0]!.length === 0 || splitted[1]!.length === 0) {
      await interaction.reply({
        content: 'fk off idiot',
        withResponse: true,
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const [gamename, tagline] = splitted;
    try {
      const account = await riotApi.Account.getByRiotId(
        gamename!,
        tagline!,
        regionToRegionGroupForAccountAPI(region as Regions)
      );
      const dbAccounts = await LeagueTable.getAccounts(interaction.user.id);

      const alreadyAdded = dbAccounts?.some((acc) => acc.riot_puuid === account.response.puuid);

      if (alreadyAdded) {
        await interaction.reply({
          content: 'Account already added',
          withResponse: true,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const leagueData = await lolApi.League.byPUUID(account.response.puuid, region as Regions);
      //FIXME NO API KEY const tftData = await tftApi.League.getByPUUID(account.response.puuid, Constants.Regions.EU_WEST)
      const league_soloq = leagueData.response.find(
        (league_data) => league_data.queueType === 'RANKED_SOLO_5x5'
      );

      await LeagueTable.insertAccount({
        discordId: interaction.user.id,
        riot_puuid: account.response.puuid,
        riot_gamename: account.response.gameName,
        riot_tagline: account.response.tagLine,
        region: region,
        leaguedata: {
          soloq:
            league_soloq !== undefined
              ? {
                lp: league_soloq.leaguePoints,
                rank: league_soloq.rank,
                tier: league_soloq.tier as Tiers,
                wins: league_soloq.wins
              }
              : undefined
        }
      });

      await interaction.reply({
        content: 'account added',
        withResponse: true,
        flags: MessageFlags.Ephemeral
      });
    } catch (e) {
      console.error(e);
      await interaction.reply({
        content: 'failed to get acc info',
        withResponse: true,
        flags: MessageFlags.Ephemeral
      });
      return;
    }
  }
}
