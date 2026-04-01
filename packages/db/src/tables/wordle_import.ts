import { DatabaseConnection } from '../connection';
import { wordleImportTable } from '../schema';
import { eq, type InferSelectModel } from 'drizzle-orm';

export type WordleImport = InferSelectModel<typeof wordleImportTable>;

export class WordleImportTable extends DatabaseConnection {
	async getGuildImport(guildId: string): Promise<WordleImport | undefined> {
		const results = await this._db.select().from(wordleImportTable).where(eq(wordleImportTable.guildId, guildId));
		return results[0];
	}

	async upsertImport(
		guildId: string,
		importedBy: string,
		messagesImported: number
	): Promise<void> {
		await this._db
			.insert(wordleImportTable)
			.values({
				guildId,
				importedBy,
				messagesImported,
				lastImport: new Date(),
			})
			.onConflictDoUpdate({
				target: wordleImportTable.guildId,
				set: {
					lastImport: new Date(),
					importedBy,
					messagesImported,
				},
			});
	}

	async canImport(guildId: string, cooldownMs: number = 24 * 60 * 60 * 1000): Promise<{
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
