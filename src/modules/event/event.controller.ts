import {
  Controller,
  Body,
  Post,
  Get,
  Param,
  UseGuards,
  Patch,
  Delete,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  BaseResponseTypeDTO,
  DecodedTokenKey,
  PaginationRequestType,
} from '@utils/index';
import { CurrentUser, RolesGuard } from '@schematics/index';
import { EventService } from './event.service';
import {
  CreateEventDTO,
  EventResponseDTO,
  DeleteEventDTO,
  UpdateEventDTO,
  EventsResponseDTO,
  FilterEventDTO,
  EventCategoryResponseDTO,
  EventAttendanceSummaryDTO,
  EventPaginationDto,
} from './dto/event.dto';
import { EventRecord } from '@entities/event.entity';

@ApiBearerAuth('JWT')
@UseGuards(RolesGuard)
@ApiTags('event')
@Controller('event')
export class EventController {
  constructor(private readonly eventSrv: EventService) {}

  @ApiOperation({ description: 'Create event' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: EventResponseDTO })
  @Post()
  async createEvent(
    @Body() payload: CreateEventDTO,
    @CurrentUser(DecodedTokenKey.USER_ID) userId,
  ): Promise<EventResponseDTO> {
    return await this.eventSrv.createEvent(payload, userId);
  }

  @ApiQuery({ name: 'eventCategoryId', required: false })
  @ApiQuery({ name: 'searchTerm', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'eventStatus', required: false })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'pageNumber', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiOperation({ description: 'Find events' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: EventsResponseDTO })
  @Get()
  async findEvents(
    @Query() payload: FilterEventDTO,
    @Query() pagination?: PaginationRequestType,
  ): Promise<EventsResponseDTO> {
    return await this.eventSrv.findEvents(payload, pagination);
  }



  @ApiQuery({ name: 'pageNumber', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiOperation({
    description: 'Find ongoing events for currently logged in user',
  })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: EventsResponseDTO })
  @Get('/ongoing/events-for-current-user')
  async findOngoingEventsForCurrentUser(
    @CurrentUser(DecodedTokenKey.USER_ID) userId: string,
    @Query() pagination?: PaginationRequestType,
  ): Promise<EventsResponseDTO> {
    return await this.eventSrv.findOngoingEventsForCurrentUser(
      userId,
      pagination,
    );
  }

  @ApiQuery({ name: 'pageNumber', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiOperation({
    description: 'Find past events for currently logged in user',
  })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: EventsResponseDTO })
  @Get('/past/events-for-current-user')
  async findPastEventsForCurrentUser(
    @CurrentUser(DecodedTokenKey.USER_ID) userId: string,
    @Query() pagination?: PaginationRequestType,
  ): Promise<EventsResponseDTO> {
    return await this.eventSrv.findPastEventsForCurrentUser(userId, pagination);
  }

  @ApiOperation({ description: 'Find event by Id' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: EventResponseDTO })
  @Get('/:eventId')
  async findEventById(
    @Param('eventId', ParseUUIDPipe) eventId: string,
  ): Promise<EventResponseDTO> {
    return await this.eventSrv.findEventById(eventId);
  }

  @ApiQuery({ name: 'pageNumber', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiOperation({ description: 'Find available events for logged-in user' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: EventsResponseDTO })
  @Get('/find/available-events')
  async findAvailableEventsForUser(
    @CurrentUser(DecodedTokenKey.USER_ID) userId: string,
    @Query() pagination?: PaginationRequestType,
  ): Promise<EventsResponseDTO> {
    return await this.eventSrv.findAvailableEventsForUser(userId, pagination);
  }

  @ApiOperation({ description: 'Get number of invites and rsvps per event' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: EventAttendanceSummaryDTO })
  @Get('/event-summary/:eventId')
  async eventSummary(
    @Param('eventId', ParseUUIDPipe) eventId: string,
  ): Promise<EventAttendanceSummaryDTO> {
    return await this.eventSrv.eventSummary(eventId);
  }

  @ApiOperation({ description: 'Find event by event-code' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: EventResponseDTO })
  @Get('/by-code/:eventCode')
  async findEventByCode(
    @Param('eventCode') eventCode: string,
  ): Promise<EventResponseDTO> {
    return await this.eventSrv.findEventByCode(eventCode);
  }

  @ApiOperation({ description: 'Find event by event-Tag' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: EventResponseDTO })
  @Get('find/by-tag/:eventTag')
  async findEventByTag(
    @Param('eventTag') eventTag: string,
  ): Promise<EventResponseDTO> {
    return await this.eventSrv.findEventByTag(eventTag);
  }

  @ApiOperation({ description: 'Find event categories', deprecated: true })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: EventCategoryResponseDTO })
  @Get('/get/event-categories')
  getEventCategories(): EventCategoryResponseDTO {
    return this.eventSrv.getEventCategories();
  }

  @ApiOperation({ description: 'Update event' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: BaseResponseTypeDTO })
  @Patch()
  async updateEvent(
    @Body() payload: UpdateEventDTO,
    @CurrentUser(DecodedTokenKey.USER_ID) userId: string,
  ): Promise<BaseResponseTypeDTO> {
    return await this.eventSrv.updateEvent(payload, userId);
  }

  @ApiOperation({ description: 'Delete events' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: BaseResponseTypeDTO })
  @Delete()
  async deleteEvents(
    @Body() { eventIds }: DeleteEventDTO,
  ): Promise<BaseResponseTypeDTO> {
    return await this.eventSrv.deleteEvents(eventIds);
  }

  @Cron(CronExpression.EVERY_4_HOURS, {
    name: 'deactivatePastEvents',
    timeZone: 'Africa/Lagos',
  })
  async deactivatePastEvents(): Promise<void> {
    await this.eventSrv.deactivatePastEvents();
  }

  @Cron(CronExpression.EVERY_30_MINUTES, {
    name: 'startOngoingEvents',
    timeZone: 'Africa/Lagos',
  })
  async startOngoingEvents(): Promise<void> {
    await this.eventSrv.startOngoingEvents();
  }

  @Cron(CronExpression.EVERY_HOUR, {
    name: 'sendRemindersToEventOrganizers',
    timeZone: 'Africa/Lagos',
  })
  async sendRemindersToEventOrganizers(): Promise<void> {
    await this.eventSrv.sendRemindersToEventOrganizers();
  }

  @Cron(CronExpression.EVERY_10_MINUTES, {
    name: 'sendNotificationToInvitees',
    timeZone: 'Africa/Lagos',
  })
  async sendNotificationToInvitees(): Promise<void> {
    return await this.eventSrv.sendNotificationToInvitees();
  }

  // @Get()
  // @ApiOperation({ summary: 'Get all events with pagination' })
  // @ApiQuery({ name: 'page', type: 'number', example: 1 })
  // @ApiQuery({ name: 'limit', type: 'number', example: 10 })
  // @ApiResponse({ status: 200, description: 'Events retrieved successfully' })
  // async getAllEvents(@Query() paginationDto: EventPaginationDto): Promise<{ data: EventRecord[]; totalCount: number }> {
  //   return this.eventService.getAllEvents(paginationDto);
  // }

  // @ApiQuery({ name: 'pageNumber', required: false })
  // @ApiQuery({ name: 'pageSize', required: false })
  // @ApiOperation({ description: 'Find events for currently logged in user' })
  // @ApiProduces('json')
  // @ApiConsumes('application/json')
  // @ApiResponse({ type: EventsResponseDTO })
  // @Get('admin/get-events-created-by-adimin')
  // async findEventsForCurrentUser(
  //   @CurrentUser(DecodedTokenKey.USER_ID) userId: string,
  //   @Query() pagination?: PaginationRequestType,
  // ): Promise<EventsResponseDTO> {
  //   return await this.eventSrv.findEventsForCurrentUser(userId, pagination);
  // }

  // @Get('admin/get-all-events')
  // @ApiOperation({ summary: 'Get all events with pagination' })
  // @ApiQuery({ name: 'page', type: 'number', example: 1 })
  // @ApiQuery({ name: 'limit', type: 'number', example: 10 })
  // @ApiResponse({ status: 200, description: 'Events retrieved successfully' })
  // async getAllEvents(@Query() paginationDto: EventPaginationDto): Promise<{ data: EventRecord[]; totalCount: number }> {
  //   return this.eventSrv.getAllEvents(paginationDto);
  // }
}
