// Loot-only test runner; does not require the database or other bot services.
import { Client, Events, GatewayIntentBits } from 'discord.js';
import { isLootRequest, lootReply } from './modules/poe-loot';

const token = process.env.BOT_TOKEN;
if (!token) throw new Error('BOT_TOKEN is required');
const response = await fetch('https://discord.com/api/v10/users/@me', {
	headers: { Authorization: `Bot ${token}` }, signal: AbortSignal.timeout(10000),
});
if (!response.ok) throw new Error('Could not verify test bot identity');
const identity = await response.json() as { id: string };
if (identity.id !== '1465292014169096212') throw new Error('This runner only supports jessjessbottest');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
client.once(Events.ClientReady, ready => console.log(`${ready.user.username} loot test is online`));
client.on(Events.MessageCreate, async message => {
	if (!message.inGuild() || message.author.bot || !message.mentions.users.has(client.user!.id)) return;
	const prompt = message.content.replace(new RegExp(`<@!?${client.user!.id}>`, 'g'), '').trim();
	if (!isLootRequest(prompt)) return;
	try {
		await message.channel.sendTyping();
		await message.reply(await lootReply(message.author.id));
	} catch (error) { console.error('Loot reply failed', error); }
});
client.on(Events.Error, error => console.error('Discord error', error));
process.on('SIGINT', () => { client.destroy(); process.exit(0); });
process.on('SIGTERM', () => { client.destroy(); process.exit(0); });
await client.login(token);
