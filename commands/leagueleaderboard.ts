import { Command } from '@sapphire/framework';
import { WinnersTable } from '../src/db/wordle';
import { GUILD_ID, RIOT_API_KEY } from '../src/environment';
import { ContainerBuilder, MessageFlags } from 'discord.js';
import { LeagueTable } from '../src/db/league';
import { Constants, LolApi, RiotApi, TftApi } from 'twisted';

const riotApi = new RiotApi({ key: RIOT_API_KEY })
const lolApi = new LolApi({ key: RIOT_API_KEY })



export class LeagueLeaderboardCommand extends Command {
    public constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, { ...options });
    }

    public override registerApplicationCommands(registry: Command.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('lol').setDescription('Check league leaderboard')
        );
    }

    public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {

        const leaderboard = await LeagueTable.leaderboard();

        if (leaderboard.length === 0) {
            await interaction.reply({
                content: "There are no accounts added",
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        const rankone = leaderboard[0].riot_puuid
        const summoner = await lolApi.Summoner.getByPUUID(rankone, Constants.Regions.EU_WEST)
        const iconURL = `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/${summoner.response.profileIconId}.jpg`

        const container = new ContainerBuilder()
            .setAccentColor(0x0099ff)
            .addSectionComponents((section) =>
                section
                    .addTextDisplayComponents(
                        (textDisplay) =>
                            textDisplay.setContent(
                                '## League Leaderboard'
                            ),
                        (textDisplay) =>
                            textDisplay.setContent(
                                leaderboard
                                    .map((l, i) => `${i + 1}. ${l.riot_gamename}#${l.riot_tagline} (${l.leaguedata?.soloq?.tier} ${l.leaguedata?.soloq?.rank} ${l.leaguedata?.soloq?.lp} LP)`)
                                    .join("\n"),
                            ),
                    )
                    .setThumbnailAccessory((thumbnail) => thumbnail.setURL(iconURL))
            );

        await interaction.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2,
        });

    }
}

