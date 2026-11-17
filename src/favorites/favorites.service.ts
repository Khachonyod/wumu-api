import { Injectable, NotFoundException } from '@nestjs/common';
import { SwipeAction } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class FavoritesService {
    constructor(private readonly prisma: PrismaService) { }

    async findAll(guestId: string) {
        const swipes = await this.prisma.userSwipe.findMany({
            where: {
                userId: guestId,
                action: SwipeAction.FAVORITE,
            },
            include: {
                game: true, // ดึงข้อมูลเกมมาด้วยแม้เกมจะหมดโปรแล้ว (isOnSale = false)
            },
            orderBy: {
                updatedAt: 'desc',
            },
        });

        return swipes.map((item) => ({
            swipedAt: item.updatedAt,
            game: item.game,
        }));
    }

    async remove(guestId: string, gameId: string) {
        const result = await this.prisma.userSwipe.deleteMany({
            where: {
                userId: guestId,
                gameId,
                action: SwipeAction.FAVORITE,
            },
        });

        if (result.count === 0) {
            throw new NotFoundException('ไม่พบเกมนี้ในรายการ Favorite');
        }

        return { deleted: true, gameId };
    }
}
