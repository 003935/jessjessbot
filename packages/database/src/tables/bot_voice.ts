import { DatabaseConnection } from '../connection';
import { type BotVoice } from '../generated/prisma/client';

export type { BotVoice };
type VoiceFields = Partial<Omit<BotVoice, 'id' | 'updatedAt'>>;

const GLOBAL_ID = 'global';

// One jjb everywhere: the voice is a single row edited by the site admin.
export class BotVoiceTable extends DatabaseConnection {
	async get(): Promise<BotVoice | null> {
		return this._db.botVoice.findUnique({ where: { id: GLOBAL_ID } });
	}

	async set(data: VoiceFields): Promise<void> {
		await this._db.botVoice.upsert({
			where: { id: GLOBAL_ID },
			create: { ...data, id: GLOBAL_ID },
			update: data,
		});
	}
}
