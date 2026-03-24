import { Command } from '@sapphire/framework';
import { db } from '@/db';
import { schema } from '@repo/database';
import { and, eq } from 'drizzle-orm';

const timestampRegex = new RegExp(/<t:(\d+):\w>/);

export class CustomsCommand extends Command {
	public constructor(context: Command.LoaderContext, options: Command.Options) {
		super(context, { ...options });
	}

	public override async registerApplicationCommands(registry: Command.Registry) {
		const games = await db._db.select().from(schema.eventGameTable);

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
						.addChoices(...games.map((game) => ({ name: game.name, value: game.name })))
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

		//TODO: get this from the database (game table)
		const gameEmoji: Record<string, string> = {
			league: '<:league:1483123245250117763>',
			valorant: '<:val:1483123363634352293>',
			deadlock: '<:deadlock:1483123050152198264>',
			tft: '<:tft:1483123304385482804>',
		};

		const game_info_arr = await db._db
			.select()
			.from(schema.eventGameTable)
			.where(eq(schema.eventGameTable.name, game));

		const game_info = game_info_arr[0];
		const emoji_id = game_info?.icon;

		let emoji_str = '';

		if (emoji_id) {
			const app = interaction.client.application;
			const emoji_cached = app.emojis.cache.get(emoji_id);
			const emoji = emoji_cached ?? (await app.emojis.fetch(emoji_id));
			emoji_str = emoji ? `<${emoji.animated ? 'a' : ''}:${emoji.name}:${emoji.id}>` : '';
		}

		const roles = await db._db
			.select()
			.from(schema.gameRoleTable)
			.where(
				and(
					eq(schema.gameRoleTable.guildId, interaction.guildId),
					eq(schema.gameRoleTable.gameName, game)
				)
			);

		const role = roles[0]?.roleId as string | undefined;

		const upperCaseGame = game.charAt(0).toUpperCase() + game.slice(1);

		const response = await interaction.reply({
			content: `## ${emoji_str} ${role ? `<@&${role}>` : ''} ${upperCaseGame} - <t:${scheduledTime}:t>\nReact with ✅ to sign up!`,
			withResponse: true,
			allowedMentions: {
				roles: role ? [role] : [],
			},
		});

		const message = response.resource!.message!;

		await db.event_table.insert({
			guildId: interaction.guildId,
			channelId: interaction.channelId,
			messageId: message.id,
			gameName: game,
			scheduledTime: scheduledDate,
		});

		await message.react('✅');
	}
}
