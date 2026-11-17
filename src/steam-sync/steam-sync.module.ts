import { Module } from '@nestjs/common';
import { SteamSyncService } from './steam-sync.service.js';
import { SteamSyncController } from './steam-sync.controller.js';

@Module({
  providers: [SteamSyncService],
  controllers: [SteamSyncController],
  exports: [SteamSyncService],
})
export class SteamSyncModule {}
