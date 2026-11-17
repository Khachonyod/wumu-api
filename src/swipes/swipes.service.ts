import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SwipeAction } from '../generated/prisma/enums.js';
import type { CreateSwipeDto } from './dto/create-swipe.dto.js'

@Injectable()
export class SwipesService {
    constructor(private readonly prisma: PrismaService) { }

    async swipe(guestId: string, dto: CreateSwipeDto) {
        // 1. ตรวจสอบว่ามีเกมนี้อยู่ใน DB จริงไหม
        const game = await this.prisma.game.findUnique({
            where: { id: dto.gameId },
            select: { id: true },
        });

        if (!game) {
            throw new NotFoundException('ไม่พบเกมนี้ในระบบ');
        }

        // 2. สร้าง User เผื่อไว้สำหรับ Guest ที่เพิ่งปัดครั้งแรก (กัน Foreign Key Error)
        await this.prisma.user.upsert({
            where: { id: guestId },
            create: { id: guestId },
            update: {},
        });

        // 3. บันทึกผลปัด (ถ้าเคยปัดเกมนี้แล้วให้ทับ action เดิมด้วย @@unique([userId, gameId]))
        return this.prisma.userSwipe.upsert({
            where: {
                userId_gameId: {
                    userId: guestId,
                    gameId: dto.gameId,
                },
            },
            create: {
                userId: guestId,
                gameId: dto.gameId,
                action: dto.action,
            },
            update: {
                action: dto.action,
            },
        });
    }

    async undoLast(guestId: string) {
        const lastSwipe = await this.prisma.userSwipe.findFirst({
            where: { userId: guestId },
            orderBy: { updatedAt: 'desc' },
            include: { game: true },
        });

        if (!lastSwipe) {
            throw new NotFoundException('ยังไม่มีประวัติการปัดให้ย้อนกลับ');
        }

        await this.prisma.userSwipe.delete({
            where: { id: lastSwipe.id },
        });

        return { undoneAction: lastSwipe.action, game: lastSwipe.game };
    }

    async resetSkipped(guestId: string) {
        const result = await this.prisma.userSwipe.deleteMany({
            where: {
                userId: guestId,
                action: SwipeAction.SKIP,
            },
        });

        return { resetCount: result.count };
    }
}
