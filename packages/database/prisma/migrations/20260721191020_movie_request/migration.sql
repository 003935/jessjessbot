-- CreateTable
CREATE TABLE "movies" (
    "imdbId" TEXT NOT NULL,
    "imdbRating" DOUBLE PRECISION NOT NULL,
    "title" TEXT NOT NULL,
    "year" SMALLINT NOT NULL,
    "runtime" TEXT NOT NULL,
    "genre" TEXT NOT NULL,
    "poster" TEXT NOT NULL,

    CONSTRAINT "movies_pkey" PRIMARY KEY ("imdbId")
);

-- CreateTable
CREATE TABLE "Request" (
    "dServerId" TEXT NOT NULL,
    "dUserID" TEXT NOT NULL,
    "imdbId" TEXT NOT NULL,

    CONSTRAINT "Request_pkey" PRIMARY KEY ("dServerId","dUserID","imdbId")
);

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_imdbId_fkey" FOREIGN KEY ("imdbId") REFERENCES "movies"("imdbId") ON DELETE CASCADE ON UPDATE CASCADE;
