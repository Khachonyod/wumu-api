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

type SteamAppDetailsResponse = Record<
    string,
    { success: boolean; data?: SteamAppDetailsData } | undefined
>;

@Injectable()
export class SteamSyncService {
    private readonly logger = new Logger(SteamSyncService.name);
    private isSyncing = false;

    constructor(private readonly prisma: PrismaService) { }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    @Cron(CronExpression.EVERY_6_HOURS)
    async handleScheduledSync(): Promise<void> {
        await this.syncDeals();
    }

    async syncDeals() {
        if (this.isSyncing) {
            this.logger.warn('กำลังซิงก์รอบก่อนหน้าอยู่ ข้ามรอบนี้');
            return { skipped: true };
        }

        this.isSyncing = true;
        try {
            // 1) ดึง specials จาก featuredcategories
            const url = 'https://store.steampowered.com/api/featuredcategories?cc=th&l=thai';
            const res = await fetch(url);
            if (!res.ok) {
                throw new Error(`Steam API error: ${res.status} ${res.statusText}`);
            }
            const data = (await res.json()) as FeaturedCategoriesResponse;
            const rawSpecials = data.specials?.items ?? [];

            // กันเกมซ้ำด้วย Map โดยใช้ id เป็น key
            const uniqueSpecials = Array.from(
                new Map(rawSpecials.map((item) => [item.id, item])).values(),
            );
            const steamAppIds = uniqueSpecials.map((item) => item.id);

            if (steamAppIds.length === 0) {
                this.logger.warn('ไม่พบเกมลดราคาจาก Steam');
                return { total: 0, updated: 0, created: 0, expired: 0 };
            }

            // 2) Smart Caching: เช็กว่าเกมไหนมีใน DB แล้ว
            const existingGames = await this.prisma.game.findMany({
                where: { steamAppId: { in: steamAppIds } },
                select: { steamAppId: true },
            });
            const existingIds = new Set(existingGames.map((g) => g.steamAppId));

            let updated = 0;
            let created = 0;

            for (const item of uniqueSpecials) {
                if (existingIds.has(item.id)) {
                    // เกมเก่า: อัปเดตราคาและสถานะลดราคาเลย ไม่ต้องยิง appdetails ซ้ำ
                    await this.prisma.game.update({
                        where: { steamAppId: item.id },
                        data: {
                            name: item.name,
                            priceInitial: item.original_price ?? 0,
                            priceFinal: item.final_price ?? 0,
                            discountPercent: item.discount_percent ?? 0,
                            isOnSale: (item.discount_percent ?? 0) > 0,
                            ...(item.header_image ? { headerImage: item.header_image } : {}),
                        },
                    });
                    updated++;
                    continue;
                }

                // เกมใหม่: ยิง appdetails + หน่วงเวลา 1.5 วิ (Rate Limit Guard)
                const detail = await this.fetchAppDetails(item.id);
                if (!detail) {
                    await this.sleep(1500);
                    continue;
                }

                const priceInitial = detail.price_overview?.initial ?? item.original_price ?? 0;
                const priceFinal = detail.price_overview?.final ?? item.final_price ?? 0;
                const discountPercent = detail.price_overview?.discount_percent ?? item.discount_percent ?? 0;
                const firstMovie = detail.movies?.[0];
                const trailerUrl = firstMovie?.hls_h264 ?? firstMovie?.mp4?.max ?? firstMovie?.webm?.max ?? null;

                await this.prisma.game.upsert({
                    where: { steamAppId: item.id },
                    update: {
                        priceInitial,
                        priceFinal,
                        discountPercent,
                        isOnSale: discountPercent > 0,
                        lastSyncedAt: new Date(),
                    },
                    create: {
                        steamAppId: item.id,
                        name: detail.name || item.name,
                        shortDescription: detail.short_description || null,
                        headerImage: detail.header_image ?? item.header_image ?? null,
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
                        categories: detail.categories?.map((c) => c.description) ?? [],
                        lastSyncedAt: new Date(),
                    },
                });
                created++;
                await this.sleep(1500);
            }

            // 3) ปิดโปรเกมที่หลุดจากรายการลดราคาแล้ว
            const expiredResult = await this.prisma.game.updateMany({
                where: {
                    isOnSale: true,
                    steamAppId: { notIn: steamAppIds },
                },
                data: {
                    isOnSale: false,
                    discountPercent: 0,
                },
            });

            const summary = {
                total: uniqueSpecials.length,
                created,
                updated,
                expired: expiredResult.count,
            };
            this.logger.log(`Sync เสร็จสิ้น: ${JSON.stringify(summary)}`);
            return summary;
        } finally {
            this.isSyncing = false;
        }
    }

    private async fetchAppDetails(
        appId: number,
    ): Promise<SteamAppDetailsData | null> {
        const url = `https://store.steampowered.com/api/appdetails?appids=${appId}&cc=th&l=thai`;
        const res = await fetch(url);
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
    }
}

