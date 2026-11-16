import { BadRequestException, createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Request } from 'express';

export const GuestId = createParamDecorator(
    (_data: unknown, ctx: ExecutionContext): string => {
        const request = ctx.switchToHttp().getRequest<Request>();
        const raw = request.headers['x-guest-id'];
        const guestId = Array.isArray(raw) ? raw[0] : raw;

        if (!guestId || guestId.trim() === '') {
            throw new BadRequestException('กรุณาส่ง Header x-guest-id');
        }

        return guestId.trim();
    },
);