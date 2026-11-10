ALTER TABLE "server_config"
ADD COLUMN "bot_ignored_users" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
