import { Module } from '@nestjs/common';
import { SwipesController } from './swipes.controller.js';
import { SwipesService } from './swipes.service.js';

@Module({
  controllers: [SwipesController],
  providers: [SwipesService]
})
export class SwipesModule {}
