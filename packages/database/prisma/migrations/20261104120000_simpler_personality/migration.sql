-- AlterTable
ALTER TABLE "bot_voice" DROP COLUMN "dislikes",
DROP COLUMN "emoji",
DROP COLUMN "examples",
DROP COLUMN "food_tastes",
DROP COLUMN "identity",
DROP COLUMN "likes",
DROP COLUMN "rules",
DROP COLUMN "style",
ADD COLUMN     "personality" TEXT;

-- AlterTable
ALTER TABLE "server_config" DROP COLUMN "bot_annoyed_lines",
DROP COLUMN "bot_dislikes",
DROP COLUMN "bot_down_lines",
DROP COLUMN "bot_fallback_reply",
DROP COLUMN "bot_greeting_lines",
DROP COLUMN "bot_lazy_lines",
DROP COLUMN "bot_likes",
DROP COLUMN "bot_meme_enabled",
DROP COLUMN "bot_meme_prompt",
DROP COLUMN "bot_personality";

-- DropTable
DROP TABLE "bot_member_behaviours";

-- DropTable
DROP TABLE "bot_relationships";

