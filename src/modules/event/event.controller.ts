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
} from './dto/event.dto';

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

  @ApiQuery({ name: 'searchTerm', required: false })
  @ApiQuery({ name: 'status', required: false })
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

  @ApiOperation({ description: 'Update event' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: BaseResponseTypeDTO })
  @Patch()
  async updateEvent(
    @Body() payload: UpdateEventDTO,
  ): Promise<BaseResponseTypeDTO> {
    return await this.eventSrv.updateEvent(payload);
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
}
