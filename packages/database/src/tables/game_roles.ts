import { DatabaseConnection } from '../connection';
import type { GameRole } from '../generated/prisma/client';

export type { GameRole };

type Id = {
	roleId: string;
	guildId: string;
};

export class GameRolesTable extends DatabaseConnection {
	constructor(db_conn: DatabaseConnection) {
		super(db_conn);
	}

	async insert(game_role: { guildId: string; gameName: string; roleId: string }): Promise<void> {
		await this._db.gameRole.create({ data: game_role });
	}

	async get_by_guild_id(guild_id: string): Promise<GameRole[]> {
		return await this._db.gameRole.findMany({
			where: { guildId: guild_id },
		});
	}

	async get_by_guildId_GameName(guildId: string, gameName: string): Promise<GameRole | null> {
		return await this._db.gameRole.findUnique({
			where: {
				guildId_gameName: {
					guildId,
					gameName,
				},
			},
		});
	}

	async get_by_role(guildId: string, roleId: string): Promise<GameRole[]> {
		return await this._db.gameRole.findMany({
			where: { roleId, guildId },
			take: 1,
		});
	}

	async role_exists_in_guild(guildId: string, roleId: string): Promise<boolean> {
		const result = await this.get_by_role(guildId, roleId);
		return result.length > 0;
	}

	async get_by_game(guildId: string, gameName: string): Promise<GameRole[]> {
		return await this._db.gameRole.findMany({
			where: { gameName, guildId },
			take: 1,
		});
	}

	async game_exists_in_guild(guildId: string, gameName: string): Promise<boolean> {
		const result = await this.get_by_game(guildId, gameName);
		return result.length > 0;
	}

	async update(
		guildId: string,
		roleId: string,
		game_role: { roleId: string; gameName: string }
	): Promise<void> {
		await this._db.gameRole.update({
			where: { guildId_roleId: { guildId, roleId } },
			data: {
				roleId: game_role.roleId,
				gameName: game_role.gameName,
			},
		});
	}

	async delete(guildId: string, roleId: string): Promise<void> {
		await this._db.gameRole.delete({
			where: { guildId_roleId: { guildId, roleId } },
		});
	}
}
