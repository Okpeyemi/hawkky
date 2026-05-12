-- CreateEnum
CREATE TYPE "SourceKind" AS ENUM ('rss', 'hn_top', 'reddit_subreddit', 'github_trending_lang', 'github_repo');

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "kind" "SourceKind" NOT NULL,
    "key" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "urlCanonical" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "content" TEXT,
    "publishedAt" TIMESTAMP(3),
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceFetch" (
    "sourceId" TEXT NOT NULL,
    "lastFetchedAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastError" TEXT,
    "etag" TEXT,
    "lastModified" TEXT,

    CONSTRAINT "SourceFetch_pkey" PRIMARY KEY ("sourceId")
);

-- CreateIndex
CREATE INDEX "Source_kind_idx" ON "Source"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "Source_kind_key_key" ON "Source"("kind", "key");

-- CreateIndex
CREATE INDEX "Subscription_userId_idx" ON "Subscription"("userId");

-- CreateIndex
CREATE INDEX "Subscription_sourceId_idx" ON "Subscription"("sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_sourceId_key" ON "Subscription"("userId", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "Item_hash_key" ON "Item"("hash");

-- CreateIndex
CREATE INDEX "Item_sourceId_fetchedAt_idx" ON "Item"("sourceId", "fetchedAt" DESC);

-- CreateIndex
CREATE INDEX "Item_publishedAt_idx" ON "Item"("publishedAt" DESC);

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceFetch" ADD CONSTRAINT "SourceFetch_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;
