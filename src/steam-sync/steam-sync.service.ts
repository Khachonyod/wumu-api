import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule'
import { PrismaService } from '../prisma/prisma.service.js';

export interface SteamSpecialItem {
    id: number;
    name: string;
    discount_percent: number;
    original_price: number;
    final_price: number;
    header_image?: string;
}

interface FeaturedCategoriesResponse {
    specials?: {
        items?: SteamSpecialItem[];
    };
}

interface SteamAppDetailsData {
    steam_appid: number;
    name: string;
    is_free?: boolean;
    short_description?: string;
    header_image?: string;
    price_overview?: {
        initial: number;
        final: number;
        discount_percent: number;
    }
    developers?: string[];
    publishers?: string[];
    genres?: Array<{ description: string }>;
    categories?: Array<{ description: string }>;
    screenshots?: Array<{ path_full: string }>;
    movies?: Array<{
        hls_h264?: string;
        mp4?: { max?: string };
        webm?: { max?: string };
    }>;
}

interface SearchResultsResponse {
    items?: Array<{
        name: string;
        logo: string;
    }>;
}

type BatchPriceOverviewResponse = Record<
    string,
    | {
          success: boolean;
          data?: {
              price_overview?: {
                  initial: number;
                  final: number;
                  discount_percent: number;
              };
          };
      }
    | undefined
>;

type SteamAppDetailsResponse = Record<
    string,
    { success: boolean; data?: SteamAppDetailsData } | undefined
>;

@Injectable()
export class SteamSyncService {
    private readonly logger = new Logger(SteamSyncService.name);
    private isSyncing = false;
    private nextSearchStart = 0;
    private lastBackgroundSyncAt = 0;

    constructor(private readonly prisma: PrismaService) { }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    @Cron(CronExpression.EVERY_6_HOURS)
    async handleScheduledSync(): Promise<void> {
        await this.syncDeals();
    }

    triggerBackgroundSyncMore(targetNew = 15): void {
        const now = Date.now();
        if (this.isSyncing || now - this.lastBackgroundSyncAt < 60_000) {
            return;
        }
        this.lastBackgroundSyncAt = now;
        void this.syncMoreDeals(targetNew).catch((err) => {
            this.logger.warn(`Background sync more failed: ${String(err)}`);
        });
    }

    async syncMoreDeals(targetNew = 10) {
        if (this.isSyncing) {
            this.logger.warn('กำลังซิงก์รอบก่อนหน้าอยู่ ข้ามรอบนี้');
            return { skipped: true, created: 0 };
        }

        this.isSyncing = true;
        try {
            let created = 0;
            const maxPages = 6;

            for (let page = 0; page < maxPages && created < targetNew; page++) {
                const start = this.nextSearchStart;
                const appIds = await this.fetchSearchSpecialAppIds(50, start);

                if (appIds.length === 0) {
                    this.nextSearchStart = 0;
                    break;
                }

                this.nextSearchStart = start + 50;

                const existingGames = await this.prisma.game.findMany({
                    where: { steamAppId: { in: appIds } },
                    select: { steamAppId: true },
                });
                const existingIds = new Set(existingGames.map((g) => g.steamAppId));
                const newAppIds = appIds.filter((id) => !existingIds.has(id));

                for (const appId of newAppIds) {
                    if (created >= targetNew) break;
                    const ok = await this.syncNewGame(appId);
                    if (ok) created++;
                    await this.sleep(1500);
                }
            }

            this.logger.log(`Sync More เสร็จสิ้น: created=${created}, nextStart=${this.nextSearchStart}`);
            return { created, nextSearchStart: this.nextSearchStart };
        } finally {
            this.isSyncing = false;
        }
    }

    async syncDeals(searchCount = 50, maxNewPerRun = 25) {
        if (this.isSyncing) {
            this.logger.warn('กำลังซิงก์รอบก่อนหน้าอยู่ ข้ามรอบนี้');
            return { skipped: true };
        }

        this.isSyncing = true;
        try {
            // 1) ดึง specials จาก featuredcategories + search/results (specials=1)
            const [featuredItems, searchAppIds] = await Promise.all([
                this.fetchFeaturedSpecials(),
                this.fetchSearchSpecialAppIds(searchCount, 0),
            ]);

            const featuredMap = new Map<number, SteamSpecialItem>(
                featuredItems.map((item) => [item.id, item]),
            );
            const steamAppIds = Array.from(
                new Set<number>([...featuredMap.keys(), ...searchAppIds]),
            );

            if (steamAppIds.length === 0) {
                this.logger.warn('ไม่พบเกมลดราคาจาก Steam');
                return { total: 0, updated: 0, created: 0, expired: 0 };
            }

            // 2) Smart Caching: แยกเกมที่มีใน DB แล้วกับเกมใหม่
            const existingGames = await this.prisma.game.findMany({
                where: { steamAppId: { in: steamAppIds } },
                select: { steamAppId: true },
            });
            const existingIds = new Set(existingGames.map((g) => g.steamAppId));

            let updated = 0;
            let created = 0;

            for (const appId of steamAppIds) {
                if (existingIds.has(appId)) {
                    const featured = featuredMap.get(appId);
                    if (featured) {
                        await this.prisma.game.update({
                            where: { steamAppId: appId },
                            data: {
                                name: featured.name,
                                priceInitial: featured.original_price ?? 0,
                                priceFinal: featured.final_price ?? 0,
                                discountPercent: featured.discount_percent ?? 0,
                                isOnSale: (featured.discount_percent ?? 0) > 0,
                                ...(featured.header_image
                                    ? { headerImage: featured.header_image }
                                    : {}),
                                lastSyncedAt: new Date(),
                            },
                        });
                        updated++;
                    }
                    continue;
                }

                if (created >= maxNewPerRun) {
                    continue;
                }

                const ok = await this.syncNewGame(appId, featuredMap.get(appId));
                if (ok) created++;
                await this.sleep(1500);
            }

            // 3) เช็กและอัปเดตราคาจริงของเกมที่กำลังลดอยู่ใน DB ทั้งหมด (รวมเกมที่มาจากหน้าถัดๆ ไปด้วย)
            const currentOnSale = await this.prisma.game.findMany({
                where: { isOnSale: true },
                select: { steamAppId: true },
            });
            const batchResult = await this.refreshPricesAndExpiry(
                currentOnSale
                    .map((g) => g.steamAppId)
                    .filter((id) => !featuredMap.has(id)),
            );

            const summary = {
                total: steamAppIds.length,
                created,
                updated: updated + batchResult.updated,
                expired: batchResult.expired,
            };
            this.logger.log(`Sync เสร็จสิ้น: ${JSON.stringify(summary)}`);
            return summary;
        } finally {
            this.isSyncing = false;
        }
    }

    private async syncNewGame(
        appId: number,
        featured?: SteamSpecialItem,
    ): Promise<boolean> {
        const detail = await this.fetchAppDetails(appId);
        if (!detail) {
            return false;
        }

        const priceInitial =
            detail.price_overview?.initial ?? featured?.original_price ?? 0;
        const priceFinal =
            detail.price_overview?.final ?? featured?.final_price ?? 0;
        const discountPercent =
            detail.price_overview?.discount_percent ??
            featured?.discount_percent ??
            0;
        const firstMovie = detail.movies?.[0];
        const trailerUrl =
            firstMovie?.hls_h264 ??
            firstMovie?.mp4?.max ??
            firstMovie?.webm?.max ??
            null;

        await this.prisma.game.upsert({
            where: { steamAppId: appId },
            update: {
                priceInitial,
                priceFinal,
                discountPercent,
                isOnSale: discountPercent > 0,
                lastSyncedAt: new Date(),
            },
            create: {
                steamAppId: appId,
                name: detail.name || featured?.name || `App ${appId}`,
                shortDescription: detail.short_description || null,
                headerImage:
                    detail.header_image ?? featured?.header_image ?? null,
                screenshots: detail.screenshots?.map((s) => s.path_full) ?? [],
                trailerUrl,
                priceInitial,
                priceFinal,
                discountPercent,
                isOnSale: discountPercent > 0,
                isFree: detail.is_free ?? false,
                developers: detail.developers ?? [],
                publishers: detail.publishers ?? [],
                genres: detail.genres?.map((g) => g.description) ?? [],
                categories:
                    detail.categories?.map((c) => c.description) ?? [],
                lastSyncedAt: new Date(),
            },
        });

        return true;
    }

    private async fetchFeaturedSpecials(): Promise<SteamSpecialItem[]> {
        try {
            const url =
                'https://store.steampowered.com/api/featuredcategories?cc=th&l=thai';
            const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
            if (!res.ok) {
                this.logger.warn(
                    `ดึง featuredcategories ไม่สำเร็จ: ${res.status} ${res.statusText}`,
                );
                return [];
            }
            const data = (await res.json()) as FeaturedCategoriesResponse;
            return data.specials?.items ?? [];
        } catch (err) {
            this.logger.warn(`ดึง featuredcategories error: ${String(err)}`);
            return [];
        }
    }

    private async fetchSearchSpecialAppIds(
        count: number,
        start = 0,
    ): Promise<number[]> {
        try {
            const url = `https://store.steampowered.com/search/results/?query=&start=${start}&count=${count}&specials=1&cc=th&l=thai&json=1`;
            const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
            if (!res.ok) {
                this.logger.warn(
                    `ดึง search/results ไม่สำเร็จ: ${res.status} ${res.statusText}`,
                );
                return [];
            }
            const data = (await res.json()) as SearchResultsResponse;
            const appIds: number[] = [];
            for (const item of data.items ?? []) {
                const match = item.logo?.match(/\/apps\/(\d+)\//);
                if (match?.[1]) {
                    appIds.push(Number(match[1]));
                }
            }
            return appIds;
        } catch (err) {
            this.logger.warn(`ดึง search/results error: ${String(err)}`);
            return [];
        }
    }

    private async refreshPricesAndExpiry(
        appIds: number[],
    ): Promise<{ updated: number; expired: number }> {
        let updated = 0;
        let expired = 0;
        const chunkSize = 25;

        for (let i = 0; i < appIds.length; i += chunkSize) {
            const chunk = appIds.slice(i, i + chunkSize);
            try {
                const url = `https://store.steampowered.com/api/appdetails?appids=${chunk.join(',')}&cc=th&filters=price_overview`;
                const res = await fetch(url, {
                    signal: AbortSignal.timeout(15000),
                });
                if (!res.ok) {
                    this.logger.warn(
                        `ดึง batch price_overview ไม่สำเร็จ: ${res.status}`,
                    );
                    continue;
                }
                const json = (await res.json()) as BatchPriceOverviewResponse;

                for (const appId of chunk) {
                    const entry = json[String(appId)];
                    if (!entry?.success) continue;

                    const price = entry.data?.price_overview;
                    if (!price || price.discount_percent <= 0) {
                        await this.prisma.game.update({
                            where: { steamAppId: appId },
                            data: {
                                isOnSale: false,
                                discountPercent: 0,
                                lastSyncedAt: new Date(),
                            },
                        });
                        expired++;
                        continue;
                    }

                    await this.prisma.game.update({
                        where: { steamAppId: appId },
                        data: {
                            priceInitial: price.initial,
                            priceFinal: price.final,
                            discountPercent: price.discount_percent,
                            isOnSale: true,
                            lastSyncedAt: new Date(),
                        },
                    });
                    updated++;
                }
            } catch (err) {
                this.logger.warn(`batch price_overview error: ${String(err)}`);
            }

            if (i + chunkSize < appIds.length) {
                await this.sleep(500);
            }
        }

        return { updated, expired };
    }

    private async fetchAppDetails(
        appId: number,
    ): Promise<SteamAppDetailsData | null> {
        try {
            const url = `https://store.steampowered.com/api/appdetails?appids=${appId}&cc=th&l=thai`;
            const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
            if (!res.ok) {
                this.logger.warn(`ดึง appdetails (${appId}) ไม่สำเร็จ: ${res.status}`);
                return null;
            }
            const json = (await res.json()) as SteamAppDetailsResponse;
            const entry = json[String(appId)];
            if (!entry?.success || !entry.data) {
                this.logger.warn(`ไม่พบข้อมูล appdetails สำหรับ ${appId}`);
                return null;
            }
            return entry.data;
        } catch (err) {
            this.logger.warn(`ดึง appdetails (${appId}) error: ${String(err)}`);
            return null;
        }
    }
}

