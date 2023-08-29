import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventRecord } from '@entities/index';
import { EventController } from './event.controller';
import { EventService } from './event.service';
import { EventInviteModule } from '../index';

@Module({
  imports: [
    TypeOrmModule.forFeature([EventRecord]),
    forwardRef(() => EventInviteModule),
  ],
  controllers: [EventController],
  providers: [EventService],
  exports: [EventService],
})
export class EventModule {}
