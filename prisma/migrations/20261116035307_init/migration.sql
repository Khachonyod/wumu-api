-- CreateEnum
CREATE TYPE "SwipeAction" AS ENUM ('FAVORITE', 'SKIP');

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "steamAppId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "shortDescription" TEXT,
    "headerImage" TEXT,
    "screenshots" TEXT[],
    "trailerUrl" TEXT,
    "priceInitial" INTEGER NOT NULL DEFAULT 0,
    "priceFinal" INTEGER NOT NULL DEFAULT 0,
    "discountPercent" INTEGER NOT NULL DEFAULT 0,
    "isOnSale" BOOLEAN NOT NULL DEFAULT false,
    "isFree" BOOLEAN NOT NULL DEFAULT false,
    "developers" TEXT[],
    "publishers" TEXT[],
    "genres" TEXT[],
    "categories" TEXT[],
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "steamId" TEXT,
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSwipe" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "action" "SwipeAction" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSwipe_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Game_steamAppId_key" ON "Game"("steamAppId");

-- CreateIndex
CREATE INDEX "Game_isOnSale_idx" ON "Game"("isOnSale");

-- CreateIndex
CREATE INDEX "Game_discountPercent_idx" ON "Game"("discountPercent");

-- CreateIndex
CREATE INDEX "Game_priceFinal_idx" ON "Game"("priceFinal");

-- CreateIndex
CREATE UNIQUE INDEX "User_steamId_key" ON "User"("steamId");

-- CreateIndex
CREATE INDEX "UserSwipe_userId_action_idx" ON "UserSwipe"("userId", "action");

-- CreateIndex
CREATE UNIQUE INDEX "UserSwipe_userId_gameId_key" ON "UserSwipe"("userId", "gameId");

-- AddForeignKey
ALTER TABLE "UserSwipe" ADD CONSTRAINT "UserSwipe_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSwipe" ADD CONSTRAINT "UserSwipe_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
