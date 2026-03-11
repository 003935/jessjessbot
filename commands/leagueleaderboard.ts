import { Command } from '@sapphire/framework';
import { WinnersTable } from '../src/db/wordle';
import { GUILD_ID, RIOT_API_KEY } from '../src/environment';
import { ContainerBuilder, MessageFlags } from 'discord.js';
import { LeagueTable } from '../src/db/league';
import { Constants, LolApi, RiotApi, TftApi } from 'twisted';
import { Tiers } from 'twisted/dist/constants';

const riotApi = new RiotApi({ key: RIOT_API_KEY })
const lolApi = new LolApi({ key: RIOT_API_KEY })

function shortenTier(tier: Tiers): string {
    switch (tier) {
        case Tiers.CHALLENGER:
            return "<:chall:1481245575323193496>"
        case Tiers.GRANDMASTER:
            return "<:gm:1481245503843995800>"
        case Tiers.MASTER:
            return "<:master:1481243836478001212>"
        case Tiers.DIAMOND:
            return "<:diamond:1481247193863291001>"
        case Tiers.EMERALD:
            return "<:emerald:1481247224762601584>"
        case Tiers.PLATINUM:
            return "<:plat:1481247241745207418>"
        case Tiers.GOLD:
            return "<:gold:1481247259504017550>"
        case Tiers.SILVER:
            return "<:silver:1481249419205804123>"
        case Tiers.BRONZE:
            return "<:bronze:1481249459185909860>"
        case Tiers.IRON:
            return "<:iron:1481249532791750758>"
        default:
            const _never: never = tier;
            return _never
    }
}


function treat_soloq(soloq_data: {
    tier: string,
    rank: string,
    lp: number
}): string {
    switch (soloq_data.tier) {
        case Tiers.CHALLENGER:
        case Tiers.GRANDMASTER:
        case Tiers.MASTER:
            return `${shortenTier(soloq_data.tier)} ${soloq_data.lp} LP`
        case Tiers.DIAMOND:
        case Tiers.EMERALD:
        case Tiers.PLATINUM:
        case Tiers.GOLD:
        case Tiers.SILVER:
        case Tiers.BRONZE:
        case Tiers.IRON:
            return `${shortenTier(soloq_data.tier)} ${soloq_data.rank} ${soloq_data.lp} LP`
        default:
            return "undefined"
    }
}

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

        await interaction.deferReply();

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
            .setAccentColor(0xAD66F2)
            .addSectionComponents((section) =>
                section
                    .addTextDisplayComponents(
                        (textDisplay) =>
                            textDisplay.setContent(
                                '## 🔥League Leaderboard'
                            ),
                        (textDisplay) =>
                            textDisplay.setContent(
                                leaderboard
                                    .map((l, i) => {
                                    const rank = l.leaguedata?.soloq
                                    ? treat_soloq(l.leaguedata.soloq)
                                    : "Unranked";
                                    return `${i + 1}. **${l.riot_gamename}#${l.riot_tagline}** ${rank}`;
})
                                    .join("\n"),
                            ),
                    )
                    .setThumbnailAccessory((thumbnail) => thumbnail.setURL(iconURL))
            );

       await interaction.editReply({  
        components: [container],
        flags: MessageFlags.IsComponentsV2,
    });
    }
}

