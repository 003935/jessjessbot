-- Affection moved from a -5..5 scale to a slow-building -100..100 meter, stored in tenths
-- (-1000..1000). Old scores map to -20..20 visible, i.e. at most "friendly".
UPDATE "bot_relationships" SET "score" = "score" * 40;
