import {
	AudioPlayerStatus,
	VoiceConnectionStatus,
	createAudioPlayer,
	createAudioResource,
	entersState,
	joinVoiceChannel,
	NoSubscriberBehavior,
	StreamType,
	type AudioPlayer,
	type VoiceConnection,
} from '@discordjs/voice';
import {
	ChannelType,
	PermissionsBitField,
	type ChatInputCommandInteraction,
} from 'discord.js';
import { Readable } from 'node:stream';
import { Logger } from '@/utils';
import { synthesizeSpeech } from './tts-client';

const logger = new Logger('Voice');
const CONNECTION_TIMEOUT_MS = 20_000;
const PLAYBACK_TIMEOUT_MS = 180_000;

type VoiceSession = {
	connection: VoiceConnection;
	player: AudioPlayer;
	queue: string[];
	processing: boolean;
};

export class VoiceCommandError extends Error {}

const sessions = new Map<string, VoiceSession>();

function destroySession(session: VoiceSession): void {
	session.queue.length = 0;
	session.player.stop(true);
	session.connection.destroy();
}

export async function joinGuildVoice(
	interaction: ChatInputCommandInteraction
): Promise<void> {
	if (!interaction.inCachedGuild())
		throw new VoiceCommandError('Use this command in a server.');

	const channel = interaction.member.voice.channel;
	if (!channel)
		throw new VoiceCommandError('Join a voice channel first, then ask me to join.');
	if (channel.type !== ChannelType.GuildVoice)
		throw new VoiceCommandError('Use /join from a regular voice channel.');

	const botMember = await interaction.guild.members.fetchMe();
	const permissions = channel.permissionsFor(botMember);
	if (
		!permissions?.has([
			PermissionsBitField.Flags.Connect,
			PermissionsBitField.Flags.Speak,
		])
	)
		throw new VoiceCommandError('I need Connect and Speak permission in that channel.');

	const previous = sessions.get(interaction.guildId);
	if (
		previous?.connection.joinConfig.channelId === channel.id &&
		previous.connection.state.status === VoiceConnectionStatus.Ready
	)
		return;
	leaveGuildVoice(interaction.guildId);

	const connection = joinVoiceChannel({
		channelId: channel.id,
		guildId: interaction.guildId,
		adapterCreator: interaction.guild.voiceAdapterCreator,
		selfDeaf: true,
		selfMute: false,
	});
	const player = createAudioPlayer({
		behaviors: { noSubscriber: NoSubscriberBehavior.Stop },
	});
	const session: VoiceSession = { connection, player, queue: [], processing: false };
	sessions.set(interaction.guildId, session);
	connection.subscribe(player);

	try {
		await entersState(connection, VoiceConnectionStatus.Ready, CONNECTION_TIMEOUT_MS);
	} catch {
		if (sessions.get(interaction.guildId) === session) {
			leaveGuildVoice(interaction.guildId);
		} else {
			destroySession(session);
		}
		throw new VoiceCommandError('I could not connect to that voice channel.');
	}
}

export function leaveGuildVoice(guildId: string): void {
	const session = sessions.get(guildId);
	if (!session) return;
	sessions.delete(guildId);
	destroySession(session);
}

function playAudio(session: VoiceSession, audio: Buffer): Promise<void> {
	return new Promise((resolve, reject) => {
		let settled = false;
		const finish = (error?: Error) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			session.player.off('stateChange', onStateChange);
			session.player.off('error', onError);
			if (error) reject(error);
			else resolve();
		};
		const onStateChange = (oldState: { status: string }, newState: { status: string }) => {
			if (oldState.status !== AudioPlayerStatus.Idle && newState.status === AudioPlayerStatus.Idle)
				finish();
		};
		const onError = (error: Error) => finish(error);
		const timer = setTimeout(
			() => finish(new Error('voice playback timed out')),
			PLAYBACK_TIMEOUT_MS
		);
		session.player.on('stateChange', onStateChange);
		session.player.on('error', onError);
		try {
			const resource = createAudioResource(Readable.from([audio]), {
				inputType: StreamType.Arbitrary,
			});
			session.player.play(resource);
		} catch (error) {
			finish(error instanceof Error ? error : new Error('voice playback failed'));
		}
	});
}

async function drainQueue(guildId: string, session: VoiceSession): Promise<void> {
	if (session.processing) return;
	session.processing = true;
	try {
		while (session.queue.length > 0 && sessions.get(guildId) === session) {
			const text = session.queue.shift();
			if (!text) continue;
			try {
				const audio = await synthesizeSpeech(text);
				if (sessions.get(guildId) !== session) break;
				await entersState(session.connection, VoiceConnectionStatus.Ready, CONNECTION_TIMEOUT_MS);
				if (sessions.get(guildId) !== session) break;
				await playAudio(session, audio);
			} catch (error) {
				logger.warn(
					`Skipping voice reply in guild ${guildId} (${error instanceof Error ? error.name : 'UnknownError'})`
				);
				if (sessions.get(guildId) !== session) break;
				if (session.connection.state.status !== VoiceConnectionStatus.Ready) {
					leaveGuildVoice(guildId);
					break;
				}
			}
		}
	} finally {
		session.processing = false;
	}
}

export function enqueueGuildSpeech(guildId: string, text: string): void {
	const session = sessions.get(guildId);
	if (!session || !text.trim()) return;
	session.queue.push(text.slice(0, 1900));
	void drainQueue(guildId, session).catch((error) => {
		logger.warn(
			`Voice queue failed in guild ${guildId} (${error instanceof Error ? error.name : 'UnknownError'})`
		);
	});
}

export function shutdownVoice(): void {
	for (const guildId of sessions.keys()) leaveGuildVoice(guildId);
}
