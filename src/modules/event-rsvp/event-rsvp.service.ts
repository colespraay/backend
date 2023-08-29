import {
  ConflictException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FindManyOptions } from 'typeorm';
import {
  calculatePaginationControls,
  checkForRequiredFields,
  compareEnumValueFields,
  validateUUIDField,
} from '@utils/index';
import { GenericService } from '@schematics/index';
import { EventRSVP } from '@entities/index';
import {
  CreateEventRSVPDTO,
  EventRSVPResponseDTO,
  EventRSVPStatus,
  EventRSVPsResponseDTO,
  FilterEventRSVPDTO,
} from './dto/event-rsvp.dto';

@Injectable()
export class EventRSVPService extends GenericService(EventRSVP) {
  async rsvpForEvent(
    payload: CreateEventRSVPDTO,
    userId: string,
  ): Promise<EventRSVPResponseDTO> {
    try {
      checkForRequiredFields(['eventId', 'status', 'userId'], {
        ...payload,
        userId,
      });
      validateUUIDField(payload.eventId, 'eventId');
      validateUUIDField(userId, 'userId');
      compareEnumValueFields(
        payload.status,
        Object.values(EventRSVPStatus),
        'status',
      );
      const rsvpRecord = await this.findOne({
        eventId: payload.eventId,
        userId,
      });
      if (rsvpRecord?.id) {
        const message = rsvpRecord.status
          ? 'User has already accepted this event'
          : 'User has already rejected this event';
        throw new ConflictException(message);
      }
      const status = payload.status === EventRSVPStatus.ACCEPTED ? true : false;
      const createdRecord = await this.create<Partial<EventRSVP>>({
        eventId: payload.eventId,
        status,
        userId,
      });
      return {
        success: true,
        code: HttpStatus.CREATED,
        message: 'Created',
        data: createdRecord,
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async findEventRSVPById(eventRSVPId: string): Promise<EventRSVPResponseDTO> {
    try {
      checkForRequiredFields(['eventRSVPId'], { eventRSVPId });
      const record = await this.getRepo().findOne({
        where: { id: eventRSVPId },
      });
      if (!record?.id) {
        throw new NotFoundException('Event RSVP not found');
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

  async findEventRSVPs(
    filterOptions: FilterEventRSVPDTO,
  ): Promise<EventRSVPsResponseDTO> {
    try {
      const filter: FindManyOptions<EventRSVP> = {
        relations: ['user', 'event', 'event.user'],
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
      if (filterOptions?.eventId) {
        validateUUIDField(filterOptions.eventId, 'eventId');
        filter.where = { ...filter.where, eventId: filterOptions.eventId };
      }
      if (filterOptions?.pageNumber && filterOptions?.pageSize) {
        filter.skip = (filterOptions.pageNumber - 1) * filterOptions.pageSize;
        filter.take = filterOptions.pageSize;
        const { response, paginationControl } =
          await calculatePaginationControls<EventRSVP>(this.getRepo(), filter, {
            pageNumber: filterOptions.pageNumber,
            pageSize: filterOptions.pageSize,
          });
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
