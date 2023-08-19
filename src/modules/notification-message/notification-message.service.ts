import { HttpStatus, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { In, LessThan } from 'typeorm';
import { NotificationMessage } from '@entities/index';
import { GenericService } from '@schematics/index';
import {
  checkForRequiredFields,
  compareEnumValueFields,
  NotificationPurpose,
  NotificationType,
  sendEmail,
  sendPushNotification,
  sendSMS,
} from '@utils/index';
import {
  CreateNotificationMessageDTO,
  NotificationMessagesResponseDTO,
} from './dto/notification-message.dto';
import { UserService } from '../index';

@Injectable()
export class NotificationMessageService extends GenericService(
  NotificationMessage,
) {
  constructor(private readonly userSrv: UserService) {
    super();
  }

  @OnEvent('notification.created', { async: true })
  async createNotifications(
    payload: CreateNotificationMessageDTO[],
  ): Promise<NotificationMessagesResponseDTO> {
    try {
      const lists: (CreateNotificationMessageDTO | any)[] = [];
      for (const item of payload) {
        checkForRequiredFields(
          ['userId', 'subject', 'message', 'purpose'],
          item,
        );
        compareEnumValueFields(
          item.purpose,
          Object.values(NotificationPurpose),
          'purpose',
        );
        const record = await this.getRepo().findOne({
          where: {
            userId: item.userId,
            subject: item.subject,
            message: item.message,
          },
          select: ['id'],
        });
        if (!record?.id) {
          const userRecord = await this.userSrv.getRepo().findOne({
            where: { id: item.userId },
            select: [
              'id',
              'email',
              'deviceId',
              'phoneNumber',
              'allowSmsNotifications',
              'allowPushNotifications',
              'allowEmailNotifications',
            ],
          });
          if (userRecord?.id) {
            if (userRecord.allowEmailNotifications && userRecord.email) {
              lists.push({ ...item, type: NotificationType.EMAIL });
            }
            if (userRecord.allowPushNotifications && userRecord.deviceId) {
              lists.push({ ...item, type: NotificationType.PUSH_NOTIFICATION });
            }
            if (userRecord.allowSmsNotifications && userRecord.phoneNumber) {
              lists.push({ ...item, type: NotificationType.SMS });
            }
          }
        }
      }
      const createdNotifications = await this.createMany<
        Partial<NotificationMessage>
      >(lists);
      return {
        success: true,
        code: HttpStatus.CREATED,
        message: 'Created',
        data: createdNotifications,
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async sendNotificationsInQueue(): Promise<void> {
    const notifications = await this.getRepo().find({
      where: { numberOfTries: LessThan(4) },
      relations: ['user'],
    });
    if (notifications?.length > 0) {
      const notificationsToDelete: string[] = [];
      for (const item of notifications) {
        try {
          switch (item.type) {
            default:
            case NotificationType.EMAIL:
              await sendEmail(item.html, item.subject, [item.user.email]);
              break;
            case NotificationType.SMS:
              if (item.user.phoneNumber) {
                await sendSMS(
                  item.message,
                  item.user.phoneNumber,
                  item.subject,
                );
              }
              break;
            case NotificationType.PUSH_NOTIFICATION:
              if (item.user.deviceId) {
                await sendPushNotification(
                  item.message,
                  item.user.deviceId,
                  item.subject,
                );
              }
              break;
          }
        } catch (ex) {
          this.logger.error(ex);
          const numberOfTries = item.numberOfTries + 1;
          await this.getRepo().update({ id: item.id }, { numberOfTries });
        }
        notificationsToDelete.push(item.id);
      }
      console.log({ notificationsToDelete });
      // Delete all notifications that have been sent
      await this.delete({ id: In(notificationsToDelete) });
    }
  }
}
