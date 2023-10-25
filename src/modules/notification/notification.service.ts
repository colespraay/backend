import {
  ConflictException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Notification } from '@entities/index';
import { GenericService } from '@schematics/index';
import {
  UserNotificationType,
  calculatePaginationControls,
  checkForRequiredFields,
  compareEnumValueFields,
  validateUUIDField,
} from '@utils/index';
import {
  CreateNotificationDTO,
  FindNotificationDTO,
  NotificationResponseDTO,
  NotificationsResponseDTO,
} from './dto/notification.dto';
import { FindManyOptions } from 'typeorm';

@Injectable()
export class NotificationService extends GenericService(Notification) {
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
      const record = await this.getRepo().findOne({
        where: { subject: payload.subject, userId: payload.userId },
        select: ['id'],
      });
      if (record?.id) {
        throw new ConflictException(
          'Similar notification already exists for user',
        );
      }
      const createdNotification = await this.create<Partial<Notification>>(
        payload,
      );
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

  async findNotifications(
    filterOptions: FindNotificationDTO,
  ): Promise<NotificationsResponseDTO> {
    try {
      console.log({ filterOptions });
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
}
