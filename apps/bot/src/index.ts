import { GatewayIntentBits, Message } from 'discord.js';
import { BOT_TOKEN } from '@/environment';
import { LogLevel, SapphireClient } from '@sapphire/framework';
import { wordle_module } from '@/modules/wordle';
import { start_background_rank_update } from '@/modules/league';
import { start_background_event_checker } from '@/modules/events';
import { Check_Attachments } from '@/modules/reaction';
import { Logger } from '@/utils';

const logger = new Logger('Bot', LogLevel.Info);
const client = new SapphireClient({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildMembers,
	],
	loadMessageCommandListeners: true,
	logger: {
		level: LogLevel.Info,
		instance: logger,
	},
	enableLoaderTraceLoggings: false,
});

// Global error handlers to prevent crashes
process.on('unhandledRejection', (reason, promise) => {
	logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
	logger.error('Uncaught Exception:', error);
});

client.on('clientReady', (client) => {
	logger.info(`${client.user?.tag} is online!`);
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
}

client.on('messageCreate', messageparser);

client.login(BOT_TOKEN).catch((error) => {
	logger.fatal('Failed to login:', error);
	process.exit(1);
});
