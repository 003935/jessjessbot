TRUNCATE TABLE "Request", "movies" CASCADE;

/*
  Warnings:

  - The primary key for the `Request` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `imdbId` on the `Request` table. All the data in the column will be lost.
  - The primary key for the `movies` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `genre` on the `movies` table. All the data in the column will be lost.
  - You are about to drop the column `poster` on the `movies` table. All the data in the column will be lost.
  - You are about to drop the column `year` on the `movies` table. All the data in the column will be lost.
  - The `runtime` column on the `movies` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `tmdbId` to the `Request` table without a default value. This is not possible if the table is not empty.
  - Added the required column `genres` to the `movies` table without a default value. This is not possible if the table is not empty.
  - Added the required column `original_title` to the `movies` table without a default value. This is not possible if the table is not empty.
  - Added the required column `release_date` to the `movies` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tmdbId` to the `movies` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `movies` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Request" DROP CONSTRAINT "Request_imdbId_fkey";

-- AlterTable
ALTER TABLE "Request" DROP CONSTRAINT "Request_pkey",
DROP COLUMN "imdbId",
ADD COLUMN     "tmdbId" INTEGER NOT NULL,
ADD CONSTRAINT "Request_pkey" PRIMARY KEY ("dServerId", "dUserID", "tmdbId");

-- AlterTable
ALTER TABLE "movies" DROP CONSTRAINT "movies_pkey",
DROP COLUMN "genre",
DROP COLUMN "poster",
DROP COLUMN "year",
ADD COLUMN     "genres" TEXT NOT NULL,
ADD COLUMN     "original_title" TEXT NOT NULL,
ADD COLUMN     "poster_path" TEXT,
ADD COLUMN     "release_date" TEXT NOT NULL,
ADD COLUMN     "tmdbId" INTEGER NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "imdbId" DROP NOT NULL,
ALTER COLUMN "imdbRating" DROP NOT NULL,
DROP COLUMN "runtime",
ADD COLUMN     "runtime" INTEGER,
ADD CONSTRAINT "movies_pkey" PRIMARY KEY ("tmdbId");

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_tmdbId_fkey" FOREIGN KEY ("tmdbId") REFERENCES "movies"("tmdbId") ON DELETE CASCADE ON UPDATE CASCADE;
