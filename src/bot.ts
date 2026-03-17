import { GatewayIntentBits } from 'discord.js';
import { BOT_TOKEN } from './environment';
import { SapphireClient } from '@sapphire/framework';
import { wordle_module } from './modules/wordle';
import { start_background_rank_update } from './modules/league';


const client = new SapphireClient({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  loadMessageCommandListeners: true
});

start_background_rank_update();

client.on('clientReady', (client) => {
  console.log(`${client.user?.tag} is online!`);
});

client.on('messageCreate', wordle_module);

client.login(BOT_TOKEN);
