import { Module } from '@nestjs/common';
import { SteamSyncModule } from '../steam-sync/steam-sync.module.js';
import { GamesController } from './games.controller.js';
import { GamesService } from './games.service.js';

@Module({
  imports: [SteamSyncModule],
  controllers: [GamesController],
  providers: [GamesService],
})
export class GamesModule {}
