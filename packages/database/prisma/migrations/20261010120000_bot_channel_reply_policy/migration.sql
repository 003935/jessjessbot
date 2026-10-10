ALTER TABLE "server_config"
ADD COLUMN "bot_disabled_channels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "bot_mention_only_channels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "bot_reply_policy_configured" BOOLEAN NOT NULL DEFAULT false;
