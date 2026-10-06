import { DatabaseConnection } from '../connection';

export class PetsTable extends DatabaseConnection {
	async byOwner(guildId: string, ownerId: string) {
		return this._db.pet.findMany({
			where: { guildId, ownerId },
			include: { photos: true },
			orderBy: { createdAt: 'asc' },
		});
	}

	async byName(guildId: string, ownerId: string, nameKey: string) {
		return this._db.pet.findUnique({
			where: { guildId_ownerId_nameKey: { guildId, ownerId, nameKey } },
			include: { photos: true },
		});
	}

	async register(
		guildId: string,
		ownerId: string,
		name: string,
		nameKey: string,
		fileId: string,
		sourceMessageId?: string
	) {
		return this._db.pet.create({
			data: { guildId, ownerId, name, nameKey, photos: { create: { fileId, sourceMessageId } } },
		});
	}

	async addPhoto(petId: string, fileId: string, sourceMessageId?: string) {
		return this._db.petPhoto.create({ data: { petId, fileId, sourceMessageId } });
	}

	async remove(petId: string) {
		return this._db.pet.delete({ where: { id: petId } });
	}
}
