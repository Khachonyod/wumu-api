import { Body, Controller, Post, Delete } from '@nestjs/common';
import { GuestId } from '../common/decorators/guest-id.decorator.js';
import { CreateSwipeDto } from './dto/create-swipe.dto.js';
import { SwipesService } from './swipes.service.js';

@Controller('swipes')
export class SwipesController {
    constructor(private readonly swipesService: SwipesService) { }

    @Post()
    swipe(@GuestId() guestId: string, @Body() dto: CreateSwipeDto) {
        return this.swipesService.swipe(guestId, dto);
    }

    @Delete('last')
    undoLast(@GuestId() guestId: string) {
        return this.swipesService.undoLast(guestId);
    }

    @Delete('skipped')
    resetSkipped(@GuestId() guestId: string) {
        return this.swipesService.resetSkipped(guestId);
    }
}
