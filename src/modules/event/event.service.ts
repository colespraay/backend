import {
  BadRequestException,
  NotFoundException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { FindManyOptions, In, ILike } from 'typeorm';
import { GenericService } from '@schematics/index';
import { EventRecord } from '@entities/index';
import {
  BaseResponseTypeDTO,
  EventCategory,
  PaginationRequestType,
  calculatePaginationControls,
  checkForRequiredFields,
  compareEnumValueFields,
  sendSMS2,
  validateFutureDate,
  validateURLField,
  validateUUIDField,
} from '@utils/index';
import {
  EventResponseDTO,
  CreateEventDTO,
  EventsResponseDTO,
  FilterEventDTO,
  UpdateEventDTO,
} from './dto/event.dto';

@Injectable()
export class EventService extends GenericService(EventRecord) {
  // constructor() {
  //   super();
  //   setTimeout(async () => {
  //     const tick = await sendSMS2(
  //       'Hello hello',
  //       ['2348173749456'],
  //       'I Do Not Care',
  //     );
  //     console.log({ tick });
  //   }, 5000);
  // }

  async createEvent(
    payload: CreateEventDTO,
    userId: string,
  ): Promise<EventResponseDTO> {
    try {
      checkForRequiredFields(
        [
          'time',
          'venue',
          'category',
          'eventName',
          'eventDescription',
          'eventDate',
          'eventCoverImage',
        ],
        payload,
      );
      validateFutureDate(payload.eventDate, 'eventDate');
      validateURLField(payload.eventCoverImage, 'eventCoverImage');
      compareEnumValueFields(
        payload.category,
        Object.values(EventCategory),
        'category',
      );
      const record = await this.getRepo().findOne({
        where: [
          { eventName: payload.eventName.toUpperCase(), userId },
          { eventDescription: payload.eventDescription.toUpperCase(), userId },
        ],
        select: ['id', 'eventName', 'eventDescription', 'eventDate'],
      });
      if (record?.id) {
        const today = new Date();
        if (new Date(record.eventDate).getTime() < today.getTime()) {
          let message = 'You have already created a similar event';
          if (record.eventName === payload.eventName.toUpperCase()) {
            message = `You have already created a similar event name`;
          }
          if (
            record.eventDescription === payload.eventDescription.toUpperCase()
          ) {
            message = `You have already created a similar event description`;
          }
          throw new BadRequestException(message);
        }
      }
      const createdEvent = await this.create<Partial<EventRecord>>({
        ...payload,
        userId,
      });
      return {
        success: true,
        message: 'Created',
        code: HttpStatus.CREATED,
        data: createdEvent,
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async findEventById(eventId: string): Promise<EventResponseDTO> {
    try {
      checkForRequiredFields(['eventId'], { eventId });
      const record = await this.getRepo().findOne({ where: { id: eventId } });
      if (!record?.id) {
        throw new NotFoundException();
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

  async findEvents(
    filterOptions: FilterEventDTO,
    pagination?: PaginationRequestType,
  ): Promise<EventsResponseDTO> {
    try {
      const filter: FindManyOptions<EventRecord> = {
        relations: ['user', 'eventInvites', 'eventInvites.user'],
      };
      if (
        typeof filterOptions.status !== 'undefined' &&
        filterOptions.status !== null
      ) {
        filter.where = { ...filter.where, status: filterOptions.status };
      }

      if (filterOptions?.category) {
        filter.where = { ...filter.where, category: filterOptions.category };
      }
      if (filterOptions?.userId) {
        filter.where = { ...filter.where, userId: filterOptions.userId };
      }
      if (filterOptions?.searchTerm) {
        filter.where = [
          {
            ...filter.where,
            eventName: ILike(`%${filterOptions.searchTerm}%`),
          },
          {
            ...filter.where,
            eventDescription: ILike(`%${filterOptions.searchTerm}%`),
          },
          {
            ...filter.where,
            eventCode: ILike(`%${filterOptions.searchTerm}%`),
          },
          {
            ...filter.where,
            venue: ILike(`%${filterOptions.searchTerm}%`),
          },
        ];
      }
      if (pagination?.pageNumber && pagination?.pageSize) {
        filter.skip = (pagination.pageNumber - 1) * pagination.pageSize;
        filter.take = pagination.pageSize;
        const { response, paginationControl } =
          await calculatePaginationControls<EventRecord>(
            this.getRepo(),
            filter,
            pagination,
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

  async updateEvent(payload: UpdateEventDTO): Promise<BaseResponseTypeDTO> {
    try {
      checkForRequiredFields(['eventId'], payload);
      const record = await this.findOne({ id: payload.eventId });
      if (!record?.id) {
        throw new NotFoundException();
      }
      if ('status' in payload) {
        record.status = payload.status;
      }
      if (payload.category && record.category !== payload.category) {
        compareEnumValueFields(
          'category',
          Object.values(EventCategory),
          'category',
        );
        record.category = payload.category;
      }
      if (payload.eventName && record.eventName !== payload.eventName) {
        record.eventName = payload.eventName.toUpperCase();
      }
      if (
        payload.eventDescription &&
        record.eventDescription !== payload.eventDescription
      ) {
        record.eventDescription = payload.eventDescription.toUpperCase();
      }
      if (payload.time && record.time !== record.time) {
        record.time = payload.time;
      }
      if (payload.eventDate) {
        validateFutureDate(payload.eventDate, 'eventDate');
        record.eventDate = new Date(payload.eventDate);
      }
      if (
        payload.eventCoverImage &&
        record.eventCoverImage !== payload.eventCoverImage
      ) {
        validateURLField(payload.eventCoverImage, 'eventCoverImage');
        record.eventCoverImage = payload.eventCoverImage;
      }
      if (payload.venue && record.venue !== payload.venue) {
        record.venue = payload.venue;
      }
      const updatedRecord: Partial<EventRecord> = {
        status: record.status,
        venue: record.venue,
        eventCoverImage: record.eventCoverImage,
        eventDate: record.eventDate,
        time: record.time,
        eventName: record.eventName,
        eventDescription: record.eventDescription,
        category: record.category,
      };
      await this.getRepo().update({ id: record.id }, updatedRecord);
      return {
        success: true,
        code: HttpStatus.OK,
        message: 'Updated',
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async deleteEvents(eventIds: string[]): Promise<BaseResponseTypeDTO> {
    try {
      checkForRequiredFields(['eventIds'], { eventIds });
      eventIds?.forEach((eventId, index) => {
        validateUUIDField(eventId, `eventId${[index]}`);
      });
      await this.validateDataToDelete({ id: In(eventIds) }, eventIds);
      await this.delete({ id: In(eventIds) });
      return {
        success: true,
        code: HttpStatus.OK,
        message: 'Deleted',
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }
}
