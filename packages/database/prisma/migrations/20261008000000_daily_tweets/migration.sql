CREATE TABLE "saved_tweets" (
  "id" TEXT PRIMARY KEY,
  "username" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "publishedAt" TIMESTAMP(3) NOT NULL,
  "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastPostedAt" TIMESTAMP(3)
);
CREATE INDEX "saved_tweets_username_lastPostedAt_idx" ON "saved_tweets"("username", "lastPostedAt");
CREATE TABLE "daily_tweet_posts" (
  "channelId" TEXT NOT NULL,
  "day" TEXT NOT NULL,
  "minute" INTEGER NOT NULL,
  "claimedAt" TIMESTAMP(3),
  "messageId" TEXT,
  "tweetId" TEXT,
  PRIMARY KEY ("channelId", "day")
);
