import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationMessage } from '@entities/index';
import { NotificationMessageService } from './notification-message.service';
import { NotificationMessageController } from './notification-message.controller';
import { AuthModule, UserModule } from '..';

@Module({
  imports: [
    TypeOrmModule.forFeature([NotificationMessage]),
    UserModule,
    AuthModule,
  ],
  providers: [NotificationMessageService],
  controllers: [NotificationMessageController],
  exports: [NotificationMessageService],
})
export class NotificationMessageModule {}
