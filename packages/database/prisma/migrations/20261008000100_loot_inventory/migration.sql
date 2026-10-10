CREATE TABLE "loot_inventory" (
  "discordId" TEXT NOT NULL,
  "itemName" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY ("discordId", "itemName")
);
CREATE INDEX "loot_inventory_discordId_quantity_idx" ON "loot_inventory"("discordId", "quantity");
