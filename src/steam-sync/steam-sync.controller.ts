import { Controller, Post } from '@nestjs/common';
import { SteamSyncService } from './steam-sync.service.js';

@Controller('steam-sync')
export class SteamSyncController {
    constructor(private readonly steamSyncService: SteamSyncService) { }

    @Post('run')
    runSync() {
        return this.steamSyncService.syncDeals();
    }

    @Post('more')
    syncMore() {
        return this.steamSyncService.syncMoreDeals(10);
    }
}
