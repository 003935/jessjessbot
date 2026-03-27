import { GatewayIntentBits, Message } from 'discord.js';
import { BOT_TOKEN } from '@/environment';
import { SapphireClient } from '@sapphire/framework';
import { wordle_module } from '@/modules/wordle';
import { start_background_rank_update } from '@/modules/league';
import { start_background_event_checker } from '@/modules/events';
import { Check_Attachments } from '@/modules/reaction';

const client = new SapphireClient({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildMembers,
	],
	loadMessageCommandListeners: true,
});

start_background_rank_update();

client.on('clientReady', (client) => {
	console.log(`${client.user?.tag} is online!`);
	start_background_event_checker(client);
});

function messageparser(message: Message<boolean>) {
	if (message.inGuild() === false) return;
	wordle_module(message);
	Check_Attachments(message);
}

client.on('messageCreate', messageparser);

client.login(BOT_TOKEN);
