import { Controller, Get, Query } from '@nestjs/common';
import { GuestId } from '../common/decorators/guest-id.decorator.js';
import { GetDeckQueryDto } from './dto/get-deck-query.dto.js';
import { GamesService } from './games.service.js';

@Controller('games')
export class GamesController {
    constructor(private readonly gamesService: GamesService) { }

    @Get('deck')
    getDeck(
        @GuestId() guestId: string,
        @Query() query: GetDeckQueryDto,
    ) {
        return this.gamesService.getDeck(guestId, query);
    }
}
