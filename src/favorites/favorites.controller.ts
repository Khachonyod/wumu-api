import { Controller, Delete, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { GuestId } from '../common/decorators/guest-id.decorator.js';
import { FavoritesService } from './favorites.service.js';

@Controller('favorites')
export class FavoritesController {
    constructor(private readonly favoritesService: FavoritesService) { }

    @Get()
    findAll(@GuestId() guestId: string) {
        return this.favoritesService.findAll(guestId);
    }

    @Delete(':gameId')
    remove(
        @GuestId() GuestId: string,
        @Param('gameId', ParseUUIDPipe) gameId: string,
    ) {
        return this.favoritesService.remove(GuestId, gameId)
    }

}
