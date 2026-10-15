-- CreateTable
CREATE TABLE "server_config" (
    "guildId" TEXT NOT NULL,
    "custom_channel" TEXT,

    CONSTRAINT "server_config_pkey" PRIMARY KEY ("guildId")
);
