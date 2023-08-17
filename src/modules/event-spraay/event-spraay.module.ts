import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventSpraay } from '@entities/index';
import { EventSpraayController } from './event-spraay.controller';
import { EventSpraayService } from './event-spraay.service';

@Module({
  imports: [TypeOrmModule.forFeature([EventSpraay])],
  providers: [EventSpraayService],
  controllers: [EventSpraayController],
  exports: [EventSpraayService],
})
export class EventSpraayModule {}
