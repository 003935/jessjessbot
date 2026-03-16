import { Command, Option } from '@sapphire/framework';
import { EventsTable } from '../src/db/event';
import { ContainerBuilder, MessageFlags } from 'discord.js';

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
                    option
                        .setName('time')
                        .setDescription('Time to play (e.g. 21:00)')
                        .setRequired(true)
                )
                .addStringOption((option) =>
                    option
                        .setName('game')
                        .setDescription('Game to play')
                        .setRequired(true)
                        .addChoices(
                            { name: 'League', value: 'league'},
                            { name: 'Valorant', value: 'valorant'},
                            { name: 'Deadlock', value: 'deadlock'},
                            { name: 'TFT', value: 'tft'},
                        )
                )
                    
        );
    }

    public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        const time = interaction.options.getString('time', true);
        const game = interaction.options.getString('game', true);

        const [hours, minutes] = time.split(':').map(Number);
        if (isNaN(hours) || isNaN(minutes)) {
            await interaction.reply({ content: 'Invalid time format. Use HH:MM e.g. `21:00`', flags: 64 });
            return;
        }

        const scheduledDate = new Date();
        scheduledDate.setHours(hours, minutes, 0, 0);

        if (scheduledDate.getTime() < Date.now()) {
            scheduledDate.setDate(scheduledDate.getDate() + 1);
        }

        const scheduledTime = Math.floor(scheduledDate.getTime() / 1000);

        const gameEmoji: Record<string, string> = {
            league: '<:league:1483123245250117763>',
            valorant: '<:val:1483123363634352293>',
            deadlock: '<:deadlock:1483123050152198264>',
            tft: '<:tft:1483123304385482804>'
        };

        const response = await interaction.reply({
        content: `## ${gameEmoji[game]} ${game.charAt(0).toUpperCase() + game.slice(1)} - <t:${scheduledTime}:t>\nReact with ✅ to sign up!`,
        withResponse: true,
        allowedMentions: { parse: [] }
        });

        const message = response.resource!.message!;

        await message.react('✅');

        await EventsTable.insert({
        messageId: message.id,
        channelId: interaction.channelId,
        scheduledTime,
        });

        const delay = scheduledDate.getTime() - Date.now();
        setTimeout(() => pingReacted(message.id, interaction.channelId, interaction.client, game), delay);

    }

}
    


async function pingReacted(messageId: string, channelId: string, client: any, game: string) {
    try {
        const channel = await client.channels.fetch(channelId) as any;
        const message = await channel.messages.fetch(messageId);
        const reaction = message.reactions.cache.get('✅');
        const users = await reaction?.users.fetch();
        
        const mentions = users
            ?.filter((u: any) => !u.bot)
            .map((u: any) => `<@${u.id}>`)
            .join(' ');

        if (mentions) {
            await channel.send({
                content: ` ${game} customs time! ${mentions}`,
                allowedMentions: { parse: ['users'] }
            });
        }

        await EventsTable.delete(messageId);
    } catch (e) {
        console.error('Failed to ping reacted users:', e);
    }
}
