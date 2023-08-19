import { Cron, CronExpression } from '@nestjs/schedule';
import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { NotificationMessageService } from './notification-message.service';

@ApiTags('notification')
@Controller('notification')
export class NotificationMessageController {
  constructor(
    private readonly notificationMessageSrv: NotificationMessageService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async sendNotificationsInQueue(): Promise<void> {
    await this.notificationMessageSrv.sendNotificationsInQueue();
  }
}
