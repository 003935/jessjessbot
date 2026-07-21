import { Command } from '@sapphire/framework';
import { RIOT_API_KEY } from '@/environment';
import { MessageFlags } from 'discord.js';
import { LolApi, RiotApi, Constants } from 'twisted';
import { db } from '@/db';
import { Logger } from '@/utils';

const logger = new Logger('AddLeagueAccount');
const riotApi = new RiotApi({ key: RIOT_API_KEY });
const lolApi = new LolApi({ key: RIOT_API_KEY });

type Region = (typeof Constants.Regions)[keyof typeof Constants.Regions];
type Tier = (typeof Constants.Tiers)[keyof typeof Constants.Tiers];

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
							Object.entries(Constants.Regions)
								.filter(([_, val]) =>
									[Constants.Regions.EU_WEST, Constants.Regions.AMERICA_NORTH].includes(val)
								)
								.map(([id, val]) => ({
									name: id,
									value: val,
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
				content: 'Provide a valid game ID in the format "gamename#tagline"',
				withResponse: true,
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		const [gamename, tagline] = splitted;
		try {
			const account = await riotApi.Account.getByRiotId(
				gamename!,
				tagline!,
				Constants.regionToRegionGroupForAccountAPI(region as Region)
			);

			const dbAccounts = await db.league.getAccounts(interaction.user.id);

			const alreadyAdded = dbAccounts?.some((acc) => acc.riotPuuid === account.response.puuid);

			if (alreadyAdded) {
				await interaction.reply({
					content: 'Account already added',
					withResponse: true,
					flags: MessageFlags.Ephemeral,
				});
				return;
			}

			const leagueData = await lolApi.League.byPUUID(account.response.puuid, region as Region);
			// TODO: Add TFT API integration when available
			// const tftData = await tftApi.League.getByPUUID(account.response.puuid, Constants.Regions.EU_WEST)
			const league_soloq = leagueData.response.find(
				(league_data) => league_data.queueType === 'RANKED_SOLO_5x5'
			);

			await db.league.insertAccount({
				discordId: interaction.user.id,
				riotPuuid: account.response.puuid,
				riotGamename: account.response.gameName,
				riotTagline: account.response.tagLine,
				region: region as Region,
				leaguedata: {
					soloq:
						league_soloq !== undefined
							? {
									lp: league_soloq.leaguePoints,
									rank: league_soloq.rank,
									tier: league_soloq.tier as Tier,
									wins: league_soloq.wins,
								}
							: undefined,
				},
			});

			await interaction.reply({
				content: 'account added',
				withResponse: true,
				flags: MessageFlags.Ephemeral,
			});
		} catch (e) {
			logger.error('Failed to get acc info', e);
			await interaction.reply({
				content: 'Failed to get account info. Please ensure the summoner name and tag are correct.',
				withResponse: true,
				flags: MessageFlags.Ephemeral,
			});
			return;
		}
	}
}
