ALTER TABLE "server_config"
ADD COLUMN "bot_lore" TEXT,
ADD COLUMN "bot_greeting_lines" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "bot_annoyed_lines" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "bot_lazy_lines" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "bot_fallback_reply" TEXT,
ADD COLUMN "bot_down_lines" JSONB,
ADD COLUMN "bot_meme_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "bot_meme_prompt" TEXT;

CREATE TABLE "bot_voice" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "identity" TEXT,
    "style" TEXT,
    "rules" TEXT,
    "examples" TEXT,
    "emoji" TEXT,
    "food_tastes" TEXT,
    "likes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dislikes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "bot_voice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bot_member_behaviours" (
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "behaviour" TEXT NOT NULL,
    "when_upset" TEXT,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "bot_member_behaviours_pkey" PRIMARY KEY ("guildId","userId")
);
