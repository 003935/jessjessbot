import { Command } from '@sapphire/framework';
import { db } from '@/db';
import { MessageFlags } from 'discord.js';

const timestampRegex = new RegExp(/<t:(\d+):\w>/);

// Cache for event games - refreshed every 5 minutes
let gamesCache: { name: string; icon: string | null }[] = [];
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getGamesFromCache() {
	const now = Date.now();
	if (now - cacheTimestamp < CACHE_TTL && gamesCache.length > 0) {
		return gamesCache;
	}
	gamesCache = await db._db.customGame.findMany();
	cacheTimestamp = now;
	return gamesCache;
}

export class CustomsCommand extends Command {
	public constructor(context: Command.LoaderContext, options: Command.Options) {
		super(context, { ...options });
	}

	public override async registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder.setName('customs').setDescription('schedule customs')
		);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		if (!interaction.inGuild()) {
			await interaction.reply({ content: 'Run this command in a guild' });
			return;
		}

		await interaction.reply({
			content: 'Use the dashboard to schedule a custom https://dash.jessawg.space/',
			flags: MessageFlags.Ephemeral,
		});
	}
}
