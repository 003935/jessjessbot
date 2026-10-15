import { Command } from '@sapphire/framework';
import { db } from '@/db';
import { Logger } from '@/utils';
import {
	deletePetPhoto,
	identifyOwnersPet,
	uploadPetPhoto,
	validPetName,
	validPetPhoto,
} from '@/modules/pets';

const logger = new Logger('Pet');

export class PetCommand extends Command {
	public constructor(context: Command.LoaderContext, options: Command.Options) {
		// Hidden for now: pet recognition needs DeepSeek's vision model. Flip to true to bring /pet back.
		super(context, { ...options, enabled: false, preconditions: ['GuildOnly'] });
	}

	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName('pet')
				.setDescription('Register your pet so jessjessbot can recognise them')
				.addSubcommand((subcommand) =>
					subcommand
						.setName('register')
						.setDescription('Register your pet with a reference photo')
						.addStringOption((option) =>
							option.setName('name').setDescription('Your pet’s name').setRequired(true)
						)
						.addAttachmentOption((option) =>
							option
								.setName('photo')
								.setDescription('Stored with DeepSeek until you remove your pet')
								.setRequired(true)
						)
				)
				.addSubcommand((subcommand) =>
					subcommand
						.setName('addphoto')
						.setDescription('Add another reference photo, up to three per pet')
						.addStringOption((option) =>
							option.setName('name').setDescription('Your registered pet’s name').setRequired(true)
						)
						.addAttachmentOption((option) =>
							option
								.setName('photo')
								.setDescription('Another clear photo of your pet')
								.setRequired(true)
						)
				)
				.addSubcommand((subcommand) =>
					subcommand
						.setName('remove')
						.setDescription('Remove your pet and delete their reference photos')
						.addStringOption((option) =>
							option.setName('name').setDescription('Your registered pet’s name').setRequired(true)
						)
				)
				.addSubcommand((subcommand) =>
					subcommand.setName('list').setDescription('See the pets you registered')
				)
				.addSubcommand((subcommand) =>
					subcommand
						.setName('identify')
						.setDescription('Privately test whether I can recognise one of your pets')
						.addAttachmentOption((option) =>
							option.setName('photo').setDescription('A new photo to compare').setRequired(true)
						)
				)
		);
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		if (!interaction.inCachedGuild()) return;
		await interaction.deferReply({ ephemeral: true });
		const guildId = interaction.guildId;
		const ownerId = interaction.user.id;
		const action = interaction.options.getSubcommand();
		try {
			if (action === 'list') {
				const pets = await db.pets.byOwner(guildId, ownerId);
				await interaction.editReply(
					pets.length
						? pets
								.map(
									(pet) =>
										`${pet.name} (${pet.photos.length} photo${pet.photos.length === 1 ? '' : 's'})`
								)
								.join('\n')
						: 'No pets registered yet. Use /pet register to add one.'
				);
				return;
			}
			if (action === 'identify') {
				const photo = interaction.options.getAttachment('photo', true);
				if (!validPetPhoto(photo)) {
					await interaction.editReply('Use a JPG, PNG, or WebP photo under 8 MB.');
					return;
				}
				const pets = await db.pets.byOwner(guildId, ownerId);
				if (!pets.some((pet) => pet.photos.length >= 2)) {
					await interaction.editReply('Register a pet with at least two example photos first.');
					return;
				}
				const match = await identifyOwnersPet(photo, guildId, ownerId);
				await interaction.editReply(
					match ? `is that ${match}??` : 'wehh i could not tell which pet that is ;-;'
				);
				return;
			}

			const name = validPetName(interaction.options.getString('name', true));
			if (!name) {
				await interaction.editReply(
					'Use a pet name under 33 characters with letters, numbers, or spaces.'
				);
				return;
			}
			const nameKey = name.toLocaleLowerCase();
			const existing = await db.pets.byName(guildId, ownerId, nameKey);

			if (action === 'remove') {
				if (!existing) {
					await interaction.editReply('I could not find that pet in your list.');
					return;
				}
				for (const photo of existing.photos) await deletePetPhoto(photo.fileId);
				await db.pets.remove(existing.id);
				await interaction.editReply(`Removed ${existing.name} and their reference photos.`);
				return;
			}

			const photo = interaction.options.getAttachment('photo', true);
			if (!validPetPhoto(photo)) {
				await interaction.editReply('Use a JPG, PNG, or WebP photo under 8 MB.');
				return;
			}
			if (action === 'register' && existing) {
				await interaction.editReply(
					`${existing.name} is already registered. Use /pet addphoto for another example.`
				);
				return;
			}
			if (action === 'addphoto' && !existing) {
				await interaction.editReply('Register that pet first with /pet register.');
				return;
			}
			if (action === 'register' && (await db.pets.byOwner(guildId, ownerId)).length >= 8) {
				await interaction.editReply('You can register up to eight pets per server.');
				return;
			}
			if (action === 'addphoto' && existing && existing.photos.length >= 3) {
				await interaction.editReply(`${existing.name} already has three reference photos.`);
				return;
			}

			const fileId = await uploadPetPhoto(photo);
			try {
				if (action === 'register') await db.pets.register(guildId, ownerId, name, nameKey, fileId);
				else await db.pets.addPhoto(existing!.id, fileId);
			} catch (error) {
				await deletePetPhoto(fileId).catch((cleanupError) =>
					logger.error('Failed to clean up pet photo after database error', cleanupError)
				);
				throw error;
			}
			await interaction.editReply(
				action === 'register'
					? `Added ${name}! The photo is stored with DeepSeek until u use /pet remove. Add at least one more with /pet addphoto so i can recognise them.`
					: `Added another photo of ${existing!.name}.`
			);
		} catch (error) {
			logger.error('Pet command failed', error);
			await interaction.editReply('wehh i could not update the pet list. try again in a bit ;-;');
		}
	}
}
