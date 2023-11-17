import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventCategory } from '@entities/index';
import { EventCategoryService } from './event-category.service';
import { EventCategoryController } from './event-category.controller';

@Module({
  imports: [TypeOrmModule.forFeature([EventCategory])],
  providers: [EventCategoryService],
  controllers: [EventCategoryController],
  exports: [EventCategoryService],
})
export class EventCategoryModule {}
