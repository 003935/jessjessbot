ALTER TABLE "server_config"
ADD COLUMN "bot_ignored_channels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
