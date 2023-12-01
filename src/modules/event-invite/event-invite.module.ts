import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventInvite } from '@entities/index';
import { EventModule } from '@modules/event/event.module';
import { UserModule } from '@modules/user/user.module';
import { EventInviteController } from './event-invite.controller';
import { EventInviteService } from './event-invite.service';

@Module({
  imports: [TypeOrmModule.forFeature([EventInvite]), EventModule, UserModule],
  providers: [EventInviteService],
  controllers: [EventInviteController],
  exports: [EventInviteService],
})
export class EventInviteModule {}
