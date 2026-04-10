-- Migrate Score enum to Int (1-6 for successes, 7 for DNF)
-- Step 1: Add temporary integer columns
ALTER TABLE "wordle_results" ADD COLUMN "score_int" INTEGER;
ALTER TABLE "failed_mentions" ADD COLUMN "score_int" INTEGER;

-- Step 2: Convert existing enum values to integers
UPDATE "wordle_results" SET "score_int" = CASE
    WHEN "score" = '1' THEN 1
    WHEN "score" = '2' THEN 2
    WHEN "score" = '3' THEN 3
    WHEN "score" = '4' THEN 4
    WHEN "score" = '5' THEN 5
    WHEN "score" = '6' THEN 6
    WHEN "score" = 'DNF' THEN 7
END;

UPDATE "failed_mentions" SET "score_int" = CASE
    WHEN "score" = '1' THEN 1
    WHEN "score" = '2' THEN 2
    WHEN "score" = '3' THEN 3
    WHEN "score" = '4' THEN 4
    WHEN "score" = '5' THEN 5
    WHEN "score" = '6' THEN 6
    WHEN "score" = 'DNF' THEN 7
END;

-- Step 3: Make the new column NOT NULL
ALTER TABLE "wordle_results" ALTER COLUMN "score_int" SET NOT NULL;
ALTER TABLE "failed_mentions" ALTER COLUMN "score_int" SET NOT NULL;

-- Step 4: Drop the old enum columns
ALTER TABLE "wordle_results" DROP COLUMN "score";
ALTER TABLE "failed_mentions" DROP COLUMN "score";

-- Step 5: Rename the new columns to 'score'
ALTER TABLE "wordle_results" RENAME COLUMN "score_int" TO "score";
ALTER TABLE "failed_mentions" RENAME COLUMN "score_int" TO "score";

-- Step 6: Drop the Score enum type
DROP TYPE "Score";
