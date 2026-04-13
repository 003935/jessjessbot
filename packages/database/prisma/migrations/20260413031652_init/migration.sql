-- CreateEnum
CREATE TYPE "Region" AS ENUM ('BR1', 'EUN1', 'EUW1', 'KR', 'LA1', 'LA2', 'NA1', 'OC1', 'TR1', 'RU', 'JP1', 'VN2', 'TW2', 'SG2', 'ME1', 'PBE1');

-- CreateEnum
CREATE TYPE "FailedMentionStatus" AS ENUM ('PENDING', 'RESOLVED', 'IGNORED');

-- CreateTable
CREATE TABLE "customs" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "scheduledTime" TIMESTAMP(3) NOT NULL,
    "gameName" TEXT NOT NULL,

    CONSTRAINT "customs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_games" (
    "name" TEXT NOT NULL,
    "icon" TEXT,

    CONSTRAINT "custom_games_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "game_roles" (
    "guildId" TEXT NOT NULL,
    "gameName" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "game_roles_pkey" PRIMARY KEY ("guildId","roleId")
);

-- CreateTable
CREATE TABLE "league_accounts" (
    "discordId" TEXT NOT NULL,
    "riotPuuid" VARCHAR(78) NOT NULL,
    "riotGamename" TEXT,
    "riotTagline" TEXT,
    "region" "Region" NOT NULL,
    "leaguedata" JSONB,
    "tftdata" JSONB,

    CONSTRAINT "league_accounts_pkey" PRIMARY KEY ("riotPuuid")
);

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "role" TEXT,
    "banned" BOOLEAN DEFAULT false,
    "banReason" TEXT,
    "banExpires" TIMESTAMP(3),

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    "impersonatedBy" TEXT,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wordle_result_messages" (
    "guildId" TEXT NOT NULL,
    "messageTimestamp" TIMESTAMP(3) NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "winningScore" INTEGER,

    CONSTRAINT "wordle_result_messages_pkey" PRIMARY KEY ("channelId","messageId")
);

-- CreateTable
CREATE TABLE "wordle_results" (
    "channelId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "discordId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,

    CONSTRAINT "wordle_results_pkey" PRIMARY KEY ("channelId","messageId","discordId")
);

-- CreateTable
CREATE TABLE "wordle_imports" (
    "guildId" TEXT NOT NULL,
    "lastImport" TIMESTAMP(3) NOT NULL,
    "importedBy" TEXT NOT NULL,
    "messagesImported" INTEGER NOT NULL,

    CONSTRAINT "wordle_imports_pkey" PRIMARY KEY ("guildId")
);

-- CreateTable
CREATE TABLE "failed_mentions" (
    "channelId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "status" "FailedMentionStatus" NOT NULL DEFAULT 'PENDING',
    "resolvedDiscordId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByDiscordId" TEXT,
    "startOfMention" INTEGER NOT NULL,

    CONSTRAINT "failed_mentions_pkey" PRIMARY KEY ("channelId","messageId","startOfMention")
);

-- CreateIndex
CREATE UNIQUE INDEX "game_roles_guildId_gameName_key" ON "game_roles"("guildId", "gameName");

-- CreateIndex
CREATE INDEX "user_email_idx" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "session_userId_token_idx" ON "session"("userId", "token");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "wordle_imports_guildId_key" ON "wordle_imports"("guildId");

-- AddForeignKey
ALTER TABLE "customs" ADD CONSTRAINT "customs_gameName_fkey" FOREIGN KEY ("gameName") REFERENCES "custom_games"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_roles" ADD CONSTRAINT "game_roles_gameName_fkey" FOREIGN KEY ("gameName") REFERENCES "custom_games"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wordle_results" ADD CONSTRAINT "wordle_results_channelId_messageId_fkey" FOREIGN KEY ("channelId", "messageId") REFERENCES "wordle_result_messages"("channelId", "messageId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "failed_mentions" ADD CONSTRAINT "failed_mentions_channelId_messageId_fkey" FOREIGN KEY ("channelId", "messageId") REFERENCES "wordle_result_messages"("channelId", "messageId") ON DELETE RESTRICT ON UPDATE CASCADE;
