import { GatewayIntentBits, Message, Partials } from 'discord.js';
import { BOT_TOKEN } from '@/environment';
import { LogLevel, SapphireClient } from '@sapphire/framework';
import { wordle_module } from '@/modules/wordle';
import { start_background_rank_update } from '@/modules/league';
import { start_background_event_checker } from '@/modules/events';
import { Check_Attachments } from '@/modules/reaction';
import { Logger } from '@/utils';
import { db } from '@/db';
import { refreshReaction, removeMessage } from '@/modules/hall';
import { Meowdule } from './modules/meowdule';
import { handleMention } from '@/modules/mention';
import { handleCustomSignup } from '@/modules/custom-signups';

const logger = new Logger('Bot', LogLevel.Info);
const client = new SapphireClient({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.GuildMessageReactions,
	],
	partials: [Partials.Message, Partials.Channel, Partials.Reaction],
	loadMessageCommandListeners: true,
	logger: {
		level: LogLevel.Info,
		instance: logger,
	},
	enableLoaderTraceLoggings: false,
});

let meowdule: undefined | Meowdule;

// Global error handlers to prevent crashes
process.on('unhandledRejection', (reason, promise) => {
	logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
	logger.error('Uncaught Exception:', error);
});

client.on('clientReady', (client) => {
	logger.info(`${client.user?.tag} is online!`);
	meowdule = new Meowdule(client);
	start_background_event_checker(client);
});

let isShuttingDown = false;

async function gracefulShutdown(signal: string) {
	if (isShuttingDown) return;
	isShuttingDown = true;

	logger.info(`${signal} received. Shutting down gracefully...`);

	try {
		await client.destroy();
		logger.info('Discord client destroyed');
	} catch (error) {
		logger.error('Error destroying Discord client:', error);
	}

	try {
		await db.disconnect();
		logger.info('Database connection closed');
	} catch (error) {
		logger.error('Error closing database connection:', error);
	}

	logger.info('Shutdown complete');
	process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

start_background_rank_update();

function messageparser(message: Message<boolean>) {
	if (message.inGuild() === false) return;
	wordle_module(message);
	Check_Attachments(message);
	meowdule?.handleMsg(message);
	handleMention(message).catch((error) => logger.error('Mention handling failed', error));
}

client.on('messageCreate', messageparser);

client.on('interactionCreate', (interaction) => {
	if (!interaction.isButton() || !interaction.customId.startsWith('custom:')) return;
	handleCustomSignup(interaction).catch(async (error) => {
		logger.error('Custom signup button failed', error);
		if (!interaction.replied && !interaction.deferred)
			await interaction
				.reply({ content: 'I could not update your signup right now.', ephemeral: true })
				.catch(() => undefined);
		else
			await interaction
				.followUp({ content: 'I could not update the signup post right now.', ephemeral: true })
				.catch(() => undefined);
	});
});

client.on('messageReactionAdd', (reaction) => {
	refreshReaction(reaction).catch((error) => logger.error('Hall reaction update failed', error));
});
client.on('messageReactionRemove', (reaction) => {
	refreshReaction(reaction).catch((error) => logger.error('Hall reaction update failed', error));
});
client.on('messageDelete', (message) => {
	removeMessage(message.channelId, message.id).catch((error) =>
		logger.error('Hall message removal failed', error)
	);
});

client.login(BOT_TOKEN).catch((error) => {
	logger.fatal('Failed to login:', error);
	process.exit(1);
});
