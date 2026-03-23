import { Command } from '@sapphire/framework';
import { db } from '@/db';

const timestampRegex = new RegExp(/<t:(\d+):\w>/);

export class CustomsCommand extends Command {
	public constructor(context: Command.LoaderContext, options: Command.Options) {
		super(context, { ...options });
	}

	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName('customs')
				.setDescription('schedule customs')
				.addStringOption((option) =>
					option.setName('time').setDescription('Time to play (e.g. 21:00)').setRequired(true)
				)
				.addStringOption((option) =>
					option
						.setName('game')
						.setDescription('Game to play')
						.setRequired(true)
						.addChoices(
							{ name: 'League', value: 'league' },
							{ name: 'Valorant', value: 'valorant' },
							{ name: 'Deadlock', value: 'deadlock' },
							{ name: 'TFT', value: 'tft' }
						)
				)
		);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		if (!interaction.inGuild()) {
			await interaction.reply({ content: 'Run this command in a guild' });
			return;
		}

		const time = interaction.options.getString('time', true);
		const game = interaction.options.getString('game', true);

		const whatever = timestampRegex.exec(time);

		if (whatever === null) {
			await interaction.reply({
				content: 'Invalid time format. Use timestamps (@time)',
				flags: 64,
			});
			return;
		}

		const unixtimestampstring = whatever[1];
		const unixnumber = parseInt(unixtimestampstring);

		if (isNaN(unixnumber)) {
			await interaction.reply({
				content: 'Invalid time format. Use timestamps (@time)',
				flags: 64,
			});
			return;
		}
		const scheduledDate = new Date(unixnumber * 1000);

		if (scheduledDate.getTime() < interaction.createdTimestamp) {
			scheduledDate.setDate(scheduledDate.getDate() + 1);
		}

		const scheduledTime = Math.floor(scheduledDate.getTime() / 1000);

		const gameEmoji: Record<string, string> = {
			league: '<:league:1483123245250117763>',
			valorant: '<:val:1483123363634352293>',
			deadlock: '<:deadlock:1483123050152198264>',
			tft: '<:tft:1483123304385482804>',
		};

		const gameRoles: Record<string, string> = {
			league: '<@&1483567229965697286>',
			valorant: '<@&1466541647318876393>',
			deadlock: '',
			tft: '',
		};

		const upperCaseGame = game.charAt(0).toUpperCase() + game.slice(1);

		const response = await interaction.reply({
			content: `## ${gameEmoji[game]} ${gameRoles[game]} ${upperCaseGame} - <t:${scheduledTime}:t>\nReact with ✅ to sign up!`,
			withResponse: true,
			allowedMentions: {
				roles: ['1483567229965697286', '1466541647318876393'],
			},
		});

		const message = response.resource!.message!;

		await db.event_table.insert({
			guildId: interaction.guildId,
			channelId: interaction.channelId,
			messageId: message.id,
			game: upperCaseGame,
			scheduledTime: scheduledDate,
		});

		await message.react('✅');
	}
}
