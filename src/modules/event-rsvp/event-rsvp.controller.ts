import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  ParseUUIDPipe,
  Query,
  UseGuards,
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
import { CurrentUser, RolesGuard } from '@schematics/index';
import { DecodedTokenKey } from '@utils/index';
import { EventRSVPService } from './event-rsvp.service';
import {
  CreateEventRSVPDTO,
  EventRSVPResponseDTO,
  EventRSVPsResponseDTO,
  FilterEventRSVPDTO,
} from './dto/event-rsvp.dto';

@ApiBearerAuth('JWT')
@UseGuards(RolesGuard)
@ApiTags('event-rsvp')
@Controller('/event-rsvp')
export class EventRSVPController {
  constructor(private readonly eventRSVPSrv: EventRSVPService) {}

  @ApiOperation({ description: 'RSVP for an event' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: EventRSVPResponseDTO })
  @Post()
  async rsvpForEvent(
    @CurrentUser(DecodedTokenKey.USER_ID) userId: string,
    @Body() payload: CreateEventRSVPDTO,
  ): Promise<EventRSVPResponseDTO> {
    return await this.eventRSVPSrv.rsvpForEvent(payload, userId);
  }

  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'eventId', required: false })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiQuery({ name: 'pageNumber', required: false })
  @ApiOperation({ description: 'Find event rsvps' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: EventRSVPsResponseDTO })
  @Get()
  async findEventRSVPs(
    @Query() payload: FilterEventRSVPDTO,
  ): Promise<EventRSVPsResponseDTO> {
    return await this.eventRSVPSrv.findEventRSVPs(payload);
  }

  @ApiOperation({ description: 'RSVP for an event by ID' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: EventRSVPResponseDTO })
  @Get('/:eventRSVPId')
  async findEventRSVPById(
    @Param('eventRSVPId', ParseUUIDPipe) eventRSVPId: string,
  ): Promise<EventRSVPResponseDTO> {
    return await this.eventRSVPSrv.findEventRSVPById(eventRSVPId);
  }
}
