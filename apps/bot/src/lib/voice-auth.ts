import { getVoiceConnection } from '@discordjs/voice';
import type { ChatInputCommandInteraction } from 'discord.js';

// The voice channel the bot is currently connected to in this guild, if any.
export function activeVoiceChannelId(interaction: ChatInputCommandInteraction<'cached'>): string | null {
	return (
		getVoiceConnection(interaction.guildId)?.joinConfig.channelId ??
		interaction.guild.members.me?.voice.channelId ??
		null
	);
}

// Returns a refusal message when the invoking member is not in the bot's voice channel.
export function voiceSessionRefusal(interaction: ChatInputCommandInteraction<'cached'>): string | null {
	const botChannelId = activeVoiceChannelId(interaction);
	if (!botChannelId) return 'I’m not in voice right now. Use /join first.';
	if (interaction.member.voice.channelId !== botChannelId)
		return 'Join my voice channel first, then try again.';
	return null;
}
