import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { FindManyOptions } from 'typeorm';
import { Notification } from '@entities/index';
import { GenericService } from '@schematics/index';
import {
  UserNotificationType,
  calculatePaginationControls,
  checkForRequiredFields,
  compareEnumValueFields,
  sendPushNotification,
  validateUUIDField,
} from '@utils/index';
import { UserService } from '@modules/user/user.service';
import {
  CreateNotificationDTO,
  FindNotificationDTO,
  NotificationResponseDTO,
  NotificationsResponseDTO,
} from './dto/notification.dto';

@Injectable()
export class NotificationService extends GenericService(Notification) {
  constructor(private readonly userSrv: UserService) {
    super();
  }

  @OnEvent('user-notification.create', { async: true })
  async createNotification(
    payload: CreateNotificationDTO,
  ): Promise<NotificationResponseDTO> {
    try {
      checkForRequiredFields(['subject', 'userId', 'message', 'type'], payload);
      compareEnumValueFields(
        payload.type,
        Object.values(UserNotificationType),
        'type',
      );
      validateUUIDField(payload.userId, 'userId');
      payload.subject = payload.subject.toUpperCase();
      const createdNotification = await this.create<Partial<Notification>>(
        payload,
      );
      const user = await this.userSrv.getRepo().findOne({
        where: { id: payload.userId },
      });
      if (user?.id && user.allowPushNotifications) {
        const pushNotifications = await sendPushNotification(
          payload.message,
          user.deviceId,
          payload.subject,
        );
        this.logger.log({ pushNotifications });
      }
      return {
        success: true,
        message: 'Created',
        code: HttpStatus.CREATED,
        data: createdNotification,
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async findNotifications(
    filterOptions: FindNotificationDTO,
  ): Promise<NotificationsResponseDTO> {
    try {
      const filter: FindManyOptions<Notification> = {
        relations: ['user'],
      };
      if (
        typeof filterOptions.status !== 'undefined' &&
        filterOptions.status !== null
      ) {
        filter.where = { ...filter.where, status: filterOptions.status };
      }
      if (filterOptions?.userId) {
        validateUUIDField(filterOptions.userId, 'userId');
        filter.where = { ...filter.where, userId: filterOptions.userId };
      }
      if (
        typeof filterOptions.isRead !== 'undefined' &&
        filterOptions.isRead !== null
      ) {
        filter.where = { ...filter.where, isRead: filterOptions.isRead };
      }
      if (filterOptions.type) {
        compareEnumValueFields(
          filterOptions.type,
          Object.values(UserNotificationType),
          'type',
        );
        filter.where = { ...filter.where, type: filterOptions.type };
      }
      if (filterOptions?.pageNumber && filterOptions?.pageSize) {
        filter.skip = (filterOptions.pageNumber - 1) * filterOptions.pageSize;
        filter.take = filterOptions.pageSize;
        const { response, paginationControl } =
          await calculatePaginationControls<Notification>(
            this.getRepo(),
            filter,
            {
              pageNumber: filterOptions.pageNumber,
              pageSize: filterOptions.pageSize,
            },
          );
        return {
          success: true,
          message: 'Records found',
          code: HttpStatus.OK,
          data: response,
          paginationControl,
        };
      }
      const users = await this.getRepo().find(filter);
      return {
        success: true,
        message: 'Records found',
        code: HttpStatus.OK,
        data: users,
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async findNotificationById(
    notificationId: string,
  ): Promise<NotificationResponseDTO> {
    try {
      checkForRequiredFields(['notificationId'], { notificationId });
      validateUUIDField(notificationId, 'notificationId');
      const record = await this.getRepo().findOne({
        where: { id: notificationId },
        relations: ['user'],
      });
      if (!record?.id) {
        throw new NotFoundException('Notification not found');
      }
      return {
        success: true,
        code: HttpStatus.OK,
        message: 'Record found',
        data: record,
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }
}
