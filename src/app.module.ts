import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { SteamSyncModule } from './steam-sync/steam-sync.module.js';
import { ScheduleModule } from '@nestjs/schedule';
import { GamesModule } from './games/games.module.js';
import { SwipesModule } from './swipes/swipes.module.js';
import { FavoritesModule } from './favorites/favorites.module.js';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    SteamSyncModule,
    GamesModule,
    SwipesModule,
    FavoritesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
