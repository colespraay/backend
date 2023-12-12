import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { EventRSVP } from '@entities/index';
import { EventRSVPService } from './event-rsvp.service';
import { EventRSVPController } from './event-rsvp.controller';

@Module({
  imports: [TypeOrmModule.forFeature([EventRSVP])],
  providers: [EventRSVPService],
  controllers: [EventRSVPController],
  exports: [EventRSVPService],
})
export class EventRSVPModule {}
