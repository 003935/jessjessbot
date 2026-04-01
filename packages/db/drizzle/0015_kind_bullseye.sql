CREATE TABLE "wordle_import_Table" (
	"guildId" varchar(20) NOT NULL,
	"lastImport" timestamp NOT NULL,
	"importedBy" varchar(20) NOT NULL,
	"messagesImported" integer NOT NULL,
	CONSTRAINT "wordle_import_Table_guildId_pk" PRIMARY KEY("guildId")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "wordle_import_table_guild_id_idx" ON "wordle_import_Table" USING btree ("guildId");