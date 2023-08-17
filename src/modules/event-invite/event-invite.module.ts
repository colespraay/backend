import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventInvite } from '@entities/index';
import { EventInviteController } from './event-invite.controller';
import { EventInviteService } from './event-invite.service';

@Module({
  imports: [TypeOrmModule.forFeature([EventInvite])],
  providers: [EventInviteService],
  controllers: [EventInviteController],
  exports: [EventInviteService],
})
export class EventInviteModule {}
