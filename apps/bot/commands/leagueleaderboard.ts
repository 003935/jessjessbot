import { Command } from '@sapphire/framework';
import { RIOT_API_KEY } from '@/environment';
import { ContainerBuilder, MessageFlags } from 'discord.js';
import { Constants, LolApi, RiotApi } from 'twisted';
import { db } from '@/db';
import { Logger } from '@/utils';

const logger = new Logger('LeagueLeaderboard');
const riotApi = new RiotApi({ key: RIOT_API_KEY });
const lolApi = new LolApi({ key: RIOT_API_KEY });

type Tier = (typeof Constants.Tiers)[keyof typeof Constants.Tiers];
type Region = (typeof Constants.Regions)[keyof typeof Constants.Regions];

function shortenTier(tier: Tier): string {
	switch (tier) {
		case Constants.Tiers.CHALLENGER:
			return '<:chall:1481245575323193496>';
		case Constants.Tiers.GRANDMASTER:
			return '<:gm:1481245503843995800>';
		case Constants.Tiers.MASTER:
			return '<:master:1481243836478001212>';
		case Constants.Tiers.DIAMOND:
			return '<:diamond:1481247193863291001>';
		case Constants.Tiers.EMERALD:
			return '<:emerald:1481247224762601584>';
		case Constants.Tiers.PLATINUM:
			return '<:plat:1481247241745207418>';
		case Constants.Tiers.GOLD:
			return '<:gold:1481247259504017550>';
		case Constants.Tiers.SILVER:
			return '<:silver:1481249419205804123>';
		case Constants.Tiers.BRONZE:
			return '<:bronze:1481249459185909860>';
		case Constants.Tiers.IRON:
			return '<:iron:1481249532791750758>';
		default:
			const _never: never = tier;
			return _never;
	}
}

function treat_soloq(soloq_data: { tier: string; rank: string; lp: number }): string {
	switch (soloq_data.tier) {
		case Constants.Tiers.CHALLENGER:
		case Constants.Tiers.GRANDMASTER:
		case Constants.Tiers.MASTER:
			return `${shortenTier(soloq_data.tier)} ${soloq_data.lp} LP`;
		case Constants.Tiers.DIAMOND:
		case Constants.Tiers.EMERALD:
		case Constants.Tiers.PLATINUM:
		case Constants.Tiers.GOLD:
		case Constants.Tiers.SILVER:
		case Constants.Tiers.BRONZE:
		case Constants.Tiers.IRON:
			return `${shortenTier(soloq_data.tier)} ${soloq_data.rank} ${soloq_data.lp} LP`;
		default:
			return 'undefined';
	}
}

export class LeagueLeaderboardCommand extends Command {
	public constructor(context: Command.LoaderContext, options: Command.Options) {
		super(context, { ...options, preconditions: ['GuildTextOnly'] });
	}

	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder.setName('lol').setDescription('Check league leaderboard')
		);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		await interaction.deferReply();

		const leaderboard = await db.league.leaderboard();

		if (leaderboard.length === 0) {
			await interaction.editReply({
				content: 'There are no accounts added',
			});
			return;
		}

		const rankone = leaderboard[0];
		if (!rankone) {
			await interaction.editReply({
				content: 'Failed to get leaderboard data',
			});
			return;
		}

		try {
			const summoner = await lolApi.Summoner.getByPUUID(
				rankone.riotPuuid,
				rankone.region as Region
			);
			const iconURL = `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/${summoner.response.profileIconId}.jpg`;
			const bee = '<:bee001:1481311305603485756>';
			const container = new ContainerBuilder()
				.setAccentColor(0xad66f2)
				.addSectionComponents((section) =>
					section
						.addTextDisplayComponents(
							(textDisplay) => textDisplay.setContent(`## ${bee} League Leaderboard`),
							(textDisplay) =>
								textDisplay.setContent(
									leaderboard
										.map((l, i) => {
											const rank = l.leaguedata?.soloq
												? treat_soloq(l.leaguedata.soloq)
												: 'Unranked';
											return `${i + 1}. **${l.riotGamename}#${l.riotTagline}** ${rank}`;
										})
										.join('\n')
								)
						)
						.setThumbnailAccessory((thumbnail) => thumbnail.setURL(iconURL))
				);

			await interaction.editReply({
				components: [container],
				flags: MessageFlags.IsComponentsV2,
			});
		} catch (error) {
			logger.error('Failed to fetch summoner data for leaderboard', error);
			await interaction.editReply({
				content: 'Failed to fetch leaderboard data',
			});
		}
	}
}
