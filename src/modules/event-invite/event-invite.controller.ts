import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { BaseResponseTypeDTO } from '@utils/index';
import { RolesGuard } from '@schematics/index';
import {
  CreateEventInvitesDTO,
  CreatedEventInvitesResponseDTO,
  DeleteEventInviteDTO,
  EventInviteResponseDTO,
} from './dto/event-invite.dto';
import { EventInviteService } from './event-invite.service';

@ApiBearerAuth('JWT')
@UseGuards(RolesGuard)
@ApiTags('event-invite')
@Controller('event-invite')
export class EventInviteController {
  constructor(private readonly eventInviteSrv: EventInviteService) {}

  @ApiOperation({ description: 'Create even invite' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: CreatedEventInvitesResponseDTO })
  @Post()
  async createEventInvites(
    @Body() payload: CreateEventInvitesDTO,
  ): Promise<CreatedEventInvitesResponseDTO> {
    return await this.eventInviteSrv.createEventInvites(payload);
  }

  @ApiOperation({ description: 'Find event invite by Id' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: EventInviteResponseDTO })
  @Get('/:eventId')
  async findEventById(
    @Param('eventInviteId', ParseUUIDPipe) eventId: string,
  ): Promise<EventInviteResponseDTO> {
    return await this.eventInviteSrv.findEventInviteById(eventId);
  }

  @ApiOperation({ description: 'Delete events invites' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: BaseResponseTypeDTO })
  @Delete()
  async deleteEventInvites(
    @Body() { eventInviteIds }: DeleteEventInviteDTO,
  ): Promise<BaseResponseTypeDTO> {
    return await this.eventInviteSrv.deleteEventInvites(eventInviteIds);
  }

  @Get('/all-event-invites/')
  @ApiOperation({ description: 'Find event invite by ID' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: EventInviteResponseDTO })
  async findEventinvites(
  ): Promise<any> {
    return await this.eventInviteSrv.getAllEventInvites();
  }
}
