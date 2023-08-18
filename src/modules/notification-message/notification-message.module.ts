import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationMessage } from '@entities/index';
import { NotificationMessageService } from './notification-message.service';
import { NotificationMessageController } from './notification-message.controller';

@Module({
  imports: [TypeOrmModule.forFeature([NotificationMessage])],
  providers: [NotificationMessageService],
  controllers: [NotificationMessageController],
  exports: [NotificationMessageService],
})
export class NotificationMessageModule {}
