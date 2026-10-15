import type { Message } from 'discord.js';
import { db } from '@/db';
import { Logger } from '@/utils';
import {
	deletePetPhoto,
	identifyOwnersPet,
	uploadPetPhoto,
	validPetName,
	validPetPhoto,
} from '@/modules/pets';

const logger = new Logger('MentionPets');

function petNameFromLabel(prompt: string): string | null {
	const label = prompt.match(
		/^(?:(?:this|that|it)(?:'s| is)\s+(?:my\s+)?(?:pet\s+)?|pet\s*:\s*)(.+?)\s*[.!?]*$/iu
	);
	return label ? validPetName(label[1]!) : null;
}

export async function labelPetFromReply(
	message: Message<true>,
	prompt: string
): Promise<string | null> {
	if (!message.reference?.messageId) return null;
	const name = petNameFromLabel(prompt);
	if (!name) return null;

	const referenced = await message.fetchReference().catch(() => null);
	if (!referenced || referenced.channelId !== message.channelId)
		return 'wehh i could not open that old picture ;-;';
	if (referenced.author.id !== message.author.id)
		return 'ask the person who posted that picture to label their own pet photo, then i can save it (ᵕ ᴗ ᵕ)';
	const photos = referenced.attachments.filter(validPetPhoto);
	if (photos.size !== 1 || referenced.attachments.size !== 1)
		return 'reply to one of your messages with exactly one JPG, PNG, or WebP photo under 8 MB.';

	const guildId = message.guild.id;
	const ownerId = message.author.id;
	const ownerPets = await db.pets.byOwner(guildId, ownerId);
	const savedAs = ownerPets.find((pet) =>
		pet.photos.some((photo) => photo.sourceMessageId === referenced.id)
	);
	if (savedAs && savedAs.name.toLocaleLowerCase() !== name.toLocaleLowerCase())
		return `i already saved that picture for ${savedAs.name}. reply to a different photo for ${name}.`;
	const existing = await db.pets.byName(guildId, ownerId, name.toLocaleLowerCase());
	if (existing?.photos.some((photo) => photo.sourceMessageId === referenced.id))
		return `i already saved that picture for ${existing.name} (ᵕ ᴗ ᵕ)`;
	if (existing && existing.photos.length >= 3)
		return `${existing.name} already has three reference photos.`;
	if (!existing && ownerPets.length >= 8) return 'u can register up to eight pets per server.';

	const fileId = await uploadPetPhoto(photos.first()!);
	try {
		if (existing) await db.pets.addPhoto(existing.id, fileId, referenced.id);
		else
			await db.pets.register(
				guildId,
				ownerId,
				name,
				name.toLocaleLowerCase(),
				fileId,
				referenced.id
			);
	} catch (error) {
		await deletePetPhoto(fileId).catch((cleanupError) =>
			logger.error('Failed to clean up pet photo after database error', cleanupError)
		);
		throw error;
	}
	const count = (existing?.photos.length ?? 0) + 1;
	return count === 1
		? `saved ${name}! reply to another photo of them so i can learn to recognise them. the photo is stored with DeepSeek until u use /pet remove (ᵕ ᴗ ᵕ)`
		: `saved another photo of ${existing!.name}! ${count}/3 examples now (ᵕ ᴗ ᵕ)`;
}

export async function identifyPetFromMention(
	message: Message<true>,
	prompt: string
): Promise<string | null> {
	if (
		!/(?:\b(?:which|what)\s+(?:cat|pet|kitten|dog)\s+is\s+(?:this|that)\b|\bwho\s+is\s+(?:this|that)\s+(?:cat|pet|kitten|dog)\b)/iu.test(
			prompt
		)
	)
		return null;
	const referenced = message.reference?.messageId
		? await message.fetchReference().catch(() => null)
		: null;
	const photo =
		message.attachments.find(validPetPhoto) ?? referenced?.attachments.find(validPetPhoto);
	if (!photo)
		return 'i can check, but attach a JPG, PNG, or WebP photo under 8 MB, or reply to one (ᵕ ᴗ ᵕ)';
	const pets = await db.pets.byOwner(message.guild.id, message.author.id);
	if (!pets.some((pet) => pet.photos.length >= 2))
		return 'save at least two example photos of your cat first, then i can try to recognise them (ᵕ ᴗ ᵕ)';
	const match = await identifyOwnersPet(photo, message.guild.id, message.author.id);
	return match ? `is that ${match}?? (ᵕ ᴗ ᵕ)` : 'wehh i cannot tell which pet that is ;-;';
}
