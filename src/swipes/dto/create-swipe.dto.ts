import { IsEnum, IsUUID } from 'class-validator';
import { SwipeAction } from '../../generated/prisma/enums.js';

export class CreateSwipeDto {
    @IsUUID()
    gameId: string;

    @IsEnum(SwipeAction)
    action: SwipeAction;
}