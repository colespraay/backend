import {
  BadRequestException,
  NotFoundException,
  HttpStatus,
  Injectable,
  Inject,
  forwardRef,
  ForbiddenException,
} from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { FindManyOptions, In, ILike } from 'typeorm';
import { GenericService } from '@schematics/index';
import { EventRSVP, EventRecord } from '@entities/index';
import {
  BaseResponseTypeDTO,
  EventCategory,
  EventStatus,
  PaginationRequestType,
  calculatePaginationControls,
  checkForRequiredFields,
  compareEnumValueFields,
  convert12HourTo24HourFormat,
  sendEmail,
  sortArray,
  validateFutureDate,
  validateTimeField,
  validateURLField,
  validateUUIDField,
} from '@utils/index';
import { EventRSVPService } from '@modules/event-rsvp/event-rsvp.service';
import {
  EventResponseDTO,
  CreateEventDTO,
  EventsResponseDTO,
  FilterEventDTO,
  UpdateEventDTO,
  EventCategoryResponseDTO,
  EventAttendanceSummaryDTO,
} from './dto/event.dto';
import { EventInviteService } from '../index';

@Injectable()
export class EventService extends GenericService(EventRecord) {
  constructor(
    @Inject(forwardRef(() => EventInviteService))
    private readonly eventInviteSrv: EventInviteService,
    private readonly eventRsvpSrv: EventRSVPService,
    private readonly eventEmitterSrv: EventEmitter2,
  ) {
    super();
  }

  async createEvent(
    payload: CreateEventDTO,
    userId: string,
  ): Promise<EventResponseDTO> {
    try {
      checkForRequiredFields(
        [
          'time',
          'venue',
          'eventCategoryId',
          'eventName',
          'eventDescription',
          'eventDate',
          'eventCoverImage',
        ],
        payload,
      );
      if (payload.eventGeoCoordinates) {
        checkForRequiredFields(
          ['longitude', 'latitude'],
          payload.eventGeoCoordinates,
        );
      }
      validateFutureDate(payload.eventDate, 'eventDate');
      validateTimeField(payload.time, 'time');
      validateURLField(payload.eventCoverImage, 'eventCoverImage');
      validateUUIDField(payload.eventCategoryId, 'eventCategoryId');
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
      const newRecord = await this.getRepo().findOne({
        where: { id: createdEvent.id },
        relations: ['user', 'eventCategory', 'eventInvites'],
      });
      return {
        success: true,
        message: 'Created',
        code: HttpStatus.CREATED,
        data: newRecord,
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async eventSummary(eventId: string): Promise<EventAttendanceSummaryDTO> {
    try {
      checkForRequiredFields(['eventId'], { eventId });
      const invites = await this.eventInviteSrv.getRepo().count({
        where: { eventId },
      });
      // Start here
      const invites2 = await this.eventInviteSrv
        .getRepo()
        .createQueryBuilder()
        .select('COUNT(DISTINCT userId)', 'count')
        .from('event_invite', 'ei')
        .where('ei.eventId = :eventId', { eventId })
        .andWhere('ei.isInviteSent = true')
        .getRawOne();
      console.log({ invites2 });
      const rsvps = await this.eventRsvpSrv.getRepo().count({
        where: { eventId },
      });
      return {
        success: true,
        code: HttpStatus.OK,
        message: 'Event summary count found',
        data: {
          totalPeopleInvited: invites,
          totalRsvp: rsvps,
        },
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async findAvailableEventsForUser(
    userId: string,
    pagination?: PaginationRequestType,
  ): Promise<EventsResponseDTO> {
    try {
      checkForRequiredFields(['userId'], { userId });
      validateUUIDField(userId, 'userId');
      const upcomingEvents = await this.getRepo().find({
        where: { eventStatus: In([EventStatus.ONGOING, EventStatus.UPCOMING]) },
        select: ['id'],
      });
      // Remove duplicates
      const eventIds = [...new Set(upcomingEvents.map(({ id }) => id))];
      const filter: FindManyOptions<EventRSVP> = {
        where: { userId, eventId: In(eventIds) },
        relations: [
          'event',
          'event.user',
          'event.eventCategory',
          'event.eventInvites',
          'event.eventInvites.user',
        ],
      };
      if (pagination?.pageNumber && pagination?.pageSize) {
        filter.skip = (pagination.pageNumber - 1) * pagination.pageSize;
        filter.take = pagination.pageSize;
        const { response, paginationControl } =
          await calculatePaginationControls<EventRSVP>(
            this.eventRsvpSrv.getRepo(),
            filter,
            pagination,
          );
        const returnedData = sortArray(
          response.map(({ event }) => event),
          'dateCreated',
        );
        return {
          success: true,
          message: 'Available events found',
          code: HttpStatus.OK,
          data: returnedData,
          paginationControl,
        };
      }
      const rsvps = await this.eventRsvpSrv.getRepo().find(filter);
      const returnedData = sortArray(
        rsvps.map(({ event }) => event),
        'dateCreated',
      );
      return {
        success: true,
        code: HttpStatus.OK,
        message: 'Available events found',
        data: returnedData,
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async findEventById(eventId: string): Promise<EventResponseDTO> {
    try {
      checkForRequiredFields(['eventId'], { eventId });
      const record = await this.getRepo().findOne({
        where: { id: eventId },
        relations: ['user', 'eventInvites', 'eventInvites.user'],
      });
      if (!record?.id) {
        throw new NotFoundException('Event not found');
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

  async findEventByCode(eventCode: string): Promise<EventResponseDTO> {
    try {
      checkForRequiredFields(['eventCode'], { eventCode });
      const record = await this.getRepo().findOne({
        where: { eventCode },
        relations: ['user', 'eventInvites', 'eventInvites.user'],
      });
      if (!record?.id) {
        throw new NotFoundException('Event not found');
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

  async findEventByTag(eventTag: string): Promise<EventResponseDTO> {
    try {
      checkForRequiredFields(['eventTag'], { eventTag });
      const record = await this.getRepo().findOne({
        where: { eventTag },
        relations: [
          'user',
          'eventCategory',
          'eventInvites',
          'eventInvites.user',
        ],
      });
      if (!record?.id) {
        throw new NotFoundException('Event not found');
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
        relations: [
          'user',
          'eventCategory',
          'eventInvites',
          'eventInvites.user',
        ],
        order: { dateCreated: 'DESC' },
      };
      if (
        typeof filterOptions.status !== 'undefined' &&
        filterOptions.status !== null
      ) {
        filter.where = { ...filter.where, status: filterOptions.status };
      }
      if (filterOptions?.eventCategoryId) {
        validateUUIDField(filterOptions.eventCategoryId, 'eventCategoryId');
        filter.where = {
          ...filter.where,
          eventCategoryId: filterOptions.eventCategoryId,
        };
      }
      if (filterOptions?.eventStatus) {
        filter.where = {
          ...filter.where,
          eventStatus: filterOptions.eventStatus,
        };
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

  // async findEventsForCurrentUser(
  //   userId: string,
  //   pagination?: PaginationRequestType,
  // ): Promise<EventsResponseDTO> {
  //   try {
  //     checkForRequiredFields(['userId'], { userId });
  //     // Pull events user created
  //     const events = await this.getRepo().find({
  //       where: { userId, status: true, eventStatus: EventStatus.UPCOMING },
  //       order: { dateCreated: 'DESC' },
  //       relations: ['user'],
  //     });
  //     console.log({ events });
  //     let eventIds = events.map(({ id }) => id);

  //     // Pull events user has been invited to
  //     const eventsInvites = await this.eventInviteSrv.findAllByCondition({
  //       eventId: In(eventIds),
  //       userId,
  //     });
  //     eventIds.push(...eventsInvites.map(({ eventId }) => eventId));

  //     // Remove duplicate eventIds
  //     eventIds = [...new Set(eventIds)];

  //     const filter: FindManyOptions<EventRecord> = {
  //       where: { id: In(eventIds) },
  //       relations: [
  //         'user',
  //         'eventCategory',
  //         'eventInvites',
  //         'eventInvites.user',
  //       ],
  //       order: { dateCreated: 'DESC' },
  //     };
  //     if (pagination?.pageNumber && pagination?.pageSize) {
  //       pagination = {
  //         pageNumber: parseInt(String(pagination.pageNumber)),
  //         pageSize: parseInt(String(pagination.pageSize)),
  //       };
  //       filter.skip = (pagination.pageNumber - 1) * pagination.pageSize;
  //       filter.take = pagination.pageSize;
  //       const { response, paginationControl } =
  //         await calculatePaginationControls<EventRecord>(
  //           this.getRepo(),
  //           filter,
  //           pagination,
  //         );
  //       return {
  //         success: true,
  //         message: 'Records found',
  //         code: HttpStatus.OK,
  //         data: response,
  //         paginationControl,
  //       };
  //     }
  //     const users = await this.getRepo().find(filter);
  //     return {
  //       success: true,
  //       message: 'Records found',
  //       code: HttpStatus.OK,
  //       data: users,
  //     };
  //   } catch (ex) {
  //     this.logger.error(ex);
  //     throw ex;
  //   }
  // }

  async findEventsForCurrentUser(
    userId: string,
    pagination?: PaginationRequestType,
  ): Promise<EventsResponseDTO> {
    try {
      checkForRequiredFields(['userId'], { userId });
      // Pull events user created
      const events = await this.getRepo().find({
        where: {
          userId,
          eventStatus: In([EventStatus.UPCOMING, EventStatus.ONGOING]),
        },
        order: { dateCreated: 'DESC' },
        relations: ['user'],
      });
      console.log({ events });
      let eventIds = events.map(({ id }) => id);
      // Pull events user has been invited to
      const eventsInvites = await this.eventInviteSrv.findAllByCondition({
        eventId: In(eventIds),
        userId,
      });
      eventIds.push(...eventsInvites.map(({ eventId }) => eventId));
      // Remove duplicate eventIds
      eventIds = [...new Set(eventIds)];

      const filter: FindManyOptions<EventRecord> = {
        where: { id: In(eventIds) },
        relations: [
          'user',
          'eventCategory',
          'eventInvites',
          'eventInvites.user',
        ],
        order: { dateCreated: 'DESC' },
      };
      if (pagination?.pageNumber && pagination?.pageSize) {
        pagination = {
          pageNumber: parseInt(String(pagination.pageNumber)),
          pageSize: parseInt(String(pagination.pageSize)),
        };
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

  async findOngoingEventsForCurrentUser(
    userId: string,
    pagination?: PaginationRequestType,
  ): Promise<EventsResponseDTO> {
    try {
      checkForRequiredFields(['userId'], { userId });
      const events = await this.findAllByCondition({
        eventStatus: EventStatus.ONGOING,
        status: true,
      });
      const eventsForUser = events.filter((event) => event.userId === userId);
      const eventInvites = await this.eventInviteSrv.getRepo().find({
        where: {
          userId,
          eventId: In(events.map(({ id }) => id)),
        },
        relations: ['event'],
      });
      eventsForUser.push(...eventInvites.map(({ event }) => event));
      const eventsForUserIds = [...new Set(eventsForUser.map(({ id }) => id))];
      const filter: FindManyOptions<EventRecord> = {
        where: { id: In(eventsForUserIds) },
        relations: [
          'user',
          'eventCategory',
          'eventInvites',
          'eventInvites.user',
        ],
        order: { dateCreated: 'DESC' },
      };
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

  async findPastEventsForCurrentUser(
    userId: string,
    pagination?: PaginationRequestType,
  ): Promise<EventsResponseDTO> {
    try {
      checkForRequiredFields(['userId'], { userId });
      const events = await this.findAllByCondition({
        eventStatus: EventStatus.PAST,
      });
      const eventsForUser = events.filter((event) => event.userId === userId);
      const eventInvites = await this.eventInviteSrv.getRepo().find({
        where: {
          userId,
          eventId: In(events.map(({ id }) => id)),
        },
        relations: ['event'],
      });
      eventsForUser.push(...eventInvites.map(({ event }) => event));
      const eventsForUserIds = [...new Set(eventsForUser.map(({ id }) => id))];
      const filter: FindManyOptions<EventRecord> = {
        where: { id: In(eventsForUserIds) },
        relations: [
          'user',
          'eventCategory',
          'eventInvites',
          'eventInvites.user',
        ],
        order: { dateCreated: 'DESC' },
      };
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

  getEventCategories(): EventCategoryResponseDTO {
    return {
      success: true,
      code: HttpStatus.OK,
      message: 'Event categories found',
      data: Object.values(EventCategory),
    };
  }

  async updateEvent(
    payload: UpdateEventDTO,
    userId: string,
  ): Promise<BaseResponseTypeDTO> {
    try {
      checkForRequiredFields(['eventId'], payload);
      const record = await this.findOne({ id: payload.eventId });
      if (!record?.id) {
        throw new NotFoundException('Event not found');
      }
      if ('status' in payload) {
        record.status = payload.status;
      }
      if (
        payload.eventCategoryId &&
        record.eventCategoryId !== payload.eventCategoryId
      ) {
        validateUUIDField(payload.eventCategoryId, 'eventCategoryId');
        record.eventCategoryId = payload.eventCategoryId;
      }
      if (payload.eventStatus && record.eventStatus !== payload.eventStatus) {
        compareEnumValueFields(
          payload.eventStatus,
          Object.values(EventStatus),
          'eventStatus',
        );
        if (userId !== record.userId) {
          throw new ForbiddenException(
            'Only user who created an event can close it',
          );
        }
        record.eventStatus = payload.eventStatus;
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
      if (payload.time && payload.time !== record.time) {
        validateTimeField(payload.time, 'time');
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
      if (
        payload.eventGeoCoordinates &&
        record.eventGeoCoordinates !== payload.eventGeoCoordinates
      ) {
        checkForRequiredFields(
          ['longitude', 'latitude'],
          payload.eventGeoCoordinates,
        );
        record.eventGeoCoordinates = payload.eventGeoCoordinates;
      }
      this.eventEmitterSrv.emit('notification.event-update', record.id);
      const updatedRecord: Partial<EventRecord> = {
        status: record.status,
        venue: record.venue,
        time: record.time,
        eventCategoryId: record.eventCategoryId,
        eventName: record.eventName,
        eventDate: record.eventDate,
        eventStatus: record.eventStatus,
        eventCoverImage: record.eventCoverImage,
        eventGeoCoordinates: record.eventGeoCoordinates,
        eventDescription: record.eventDescription,
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

  async startOngoingEvents(): Promise<void> {
    try {
      const events = await this.findAllByCondition({
        status: true,
        eventStatus: EventStatus.UPCOMING,
      });
      if (events?.length > 0) {
        const eventsList = events.filter(({ eventDate, time }) => {
          const castEventDate = new Date(eventDate);
          const timeString = convert12HourTo24HourFormat(time);
          const [hours, minutes] = timeString.split(':').map(Number);
          castEventDate.setHours(hours);
          castEventDate.setMinutes(minutes);

          // Return events who's start Date has opened
          return castEventDate.getTime() >= new Date().getTime();
        });
        await this.getRepo().update(
          { id: In(eventsList.map(({ id }) => id)) },
          { eventStatus: EventStatus.ONGOING },
        );
      }
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async deactivatePastEvents(): Promise<void> {
    try {
      const events = await this.findAllByCondition({ status: true });
      if (events?.length > 0) {
        const eventIds: string[] = [];
        const today = new Date();
        for (const event of events) {
          const eventDate = new Date(event.eventDate);
          if (eventDate.getTime() > today.getTime()) {
            eventIds.push(event.id);
          }
        }
        await this.getRepo().update(
          { id: In(eventIds) },
          { status: false, eventStatus: EventStatus.PAST },
        );
      }
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  @OnEvent('notification.event-update', { async: true })
  private async sendNotificationToEventRsvps(eventId: string): Promise<void> {
    try {
      checkForRequiredFields(['eventId'], { eventId });
      const event = await this.getRepo().findOne({
        where: { id: eventId },
        relations: ['eventRsvps', 'eventRsvps.user'],
      });
      if (event?.id) {
        const emails = event.eventRsvps.map(({ user }) => user.email);
        if (emails?.length > 0) {
          const html = `
            <h1>Event Updated</h1>
            <p>Name: ${event.eventName}</p>
            <p>Venue: ${event.venue}</p>
            <p>Date: ${new Date(event.dateCreated).toLocaleDateString()}, ${
            event.time
          }
            </p>
          `;
          await sendEmail(html, `Event ${event.eventName} Updated`, emails);
        }
      }
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }
}
