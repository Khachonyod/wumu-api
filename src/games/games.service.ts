import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SteamSyncService } from '../steam-sync/steam-sync.service.js';
import type { GetDeckQueryDto } from './dto/get-deck-query.dto.js';

@Injectable()
export class GamesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly steamSyncService: SteamSyncService,
    ) { }

    async getDeck(guestId: string, query: GetDeckQueryDto) {
        const where: Prisma.GameWhereInput = {
            isOnSale: true,
            swipes: {
                none: { userId: guestId },
            },
        };

        if (query.genres) {
            const genreList = query.genres.split(',').map((g) => g.trim()).filter(Boolean);
            if (genreList.length > 0) {
                where.genres = { hasSome: genreList };
            }
        }

        if (query.categories) {
            const categoryList = query.categories.split(',').map((c) => c.trim()).filter(Boolean);
            if (categoryList.length > 0) {
                where.categories = { hasSome: categoryList };
            }
        }

        if (query.developer) {
            where.developers = { has: query.developer.trim() };
        }

        if (query.publisher) {
            where.publishers = { has: query.publisher.trim() };
        }

        if (query.maxPrice !== undefined) {
            where.priceFinal = { lte: query.maxPrice * 100 }; // แปลงบาท -> สตางค์
        }

        if (query.minDiscount !== undefined) {
            where.discountPercent = { gte: query.minDiscount };
        }

        const games = await this.prisma.game.findMany({
            where,
            orderBy: { discountPercent: 'desc' },
            take: query.limit ?? 20,
        });

        // ถ้าการ์ดที่เหลือให้ปัดใกล้หมด ให้ดึงชุดถัดไปจาก Steam รอไว้เบื้องหลัง
        if (games.length < 10) {
            this.steamSyncService.triggerBackgroundSyncMore(15);
        }

        return games;
    }
}
