import { DatabaseConnection } from '../connection';
import type { WordleImport } from '../generated/prisma/client';

export type { WordleImport };

export class WordleImportTable extends DatabaseConnection {
	async getGuildImport(guildId: string): Promise<WordleImport | null> {
		return await this._db.wordleImport.findUnique({
			where: { guildId },
		});
	}

	async upsertImport(guildId: string, importedBy: string, messagesImported: number): Promise<void> {
		await this._db.wordleImport.upsert({
			where: { guildId },
			create: {
				guildId,
				importedBy,
				messagesImported,
				lastImport: new Date(),
			},
			update: {
				lastImport: new Date(),
				importedBy,
				messagesImported,
			},
		});
	}

	async canImport(
		guildId: string,
		cooldownMs: number = 24 * 60 * 60 * 1000
	): Promise<{
		allowed: boolean;
		lastImport?: Date;
		remainingMs?: number;
	}> {
		const record = await this.getGuildImport(guildId);

		if (!record) {
			return { allowed: true };
		}

		const now = Date.now();
		const lastImportTime = record.lastImport.getTime();
		const elapsed = now - lastImportTime;

		if (elapsed >= cooldownMs) {
			return { allowed: true };
		}

		return {
			allowed: false,
			lastImport: record.lastImport,
			remainingMs: cooldownMs - elapsed,
		};
	}
}
