import {
	type InferSelectModel,
	type InferInsertModel,
	inArray,
	notInArray,
	and,
} from 'drizzle-orm';
import { DatabaseConnection } from '../connection';
import { gameRoleTable } from '../schema';
import { eq } from 'drizzle-orm';

export type GameRole = InferSelectModel<typeof gameRoleTable>;
type InsertGameRole = InferInsertModel<typeof gameRoleTable>;

type Id = {
	roleId: string;
	guildId: string;
};

export class GameRolesTable extends DatabaseConnection {
	constructor(db_conn: DatabaseConnection) {
		super(db_conn);
	}

	async insert(game_role: InsertGameRole) {
		await this._db.insert(gameRoleTable).values(game_role);
	}

	async get_by_guild_id(guild_id: string) {
		return await this._db.select().from(gameRoleTable).where(eq(gameRoleTable.guildId, guild_id));
	}

	async get_by_role(guildId: string, roleId: string) {
		return await this._db
			.select()
			.from(gameRoleTable)
			.where(and(eq(gameRoleTable.roleId, roleId), eq(gameRoleTable.guildId, guildId)))
			.limit(1);
	}

	async role_exists_in_guild(guildId: string, roleId: string) {
		const result = await this.get_by_role(guildId, roleId);
		return result.length > 0;
	}

	async get_by_game(guildId: string, gameName: string) {
		return await this._db
			.select()
			.from(gameRoleTable)
			.where(and(eq(gameRoleTable.gameName, gameName), eq(gameRoleTable.guildId, guildId)))
			.limit(1);
	}

	async game_exists_in_guild(guildId: string, gameName: string) {
		const result = await this.get_by_game(guildId, gameName);
		return result.length > 0;
	}

	async update(guildId: string, roleId: string, game_role: Omit<InsertGameRole, 'guildId'>) {
		await this._db
			.update(gameRoleTable)
			.set({
				roleId: game_role.roleId,
				gameName: game_role.gameName,
			})
			.where(and(eq(gameRoleTable.roleId, roleId), eq(gameRoleTable.guildId, guildId)));
	}

	async delete(guildId: string, roleId: string) {
		await this._db
			.delete(gameRoleTable)
			.where(and(eq(gameRoleTable.roleId, roleId), eq(gameRoleTable.guildId, guildId)));
	}
}
