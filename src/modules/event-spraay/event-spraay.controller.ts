import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  UseGuards,
  ParseUUIDPipe,
  Body,
} from '@nestjs/common';
import {
  ApiTags,
  ApiQuery,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiProduces,
} from '@nestjs/swagger';
import { User } from '@entities/index';
import { DecodedTokenKey } from '@utils/index';
import { CurrentUser, RolesGuard } from '@schematics/index';
import { EventSpraayService } from './event-spraay.service';
import {
  FindEventSpraaysDTO,
  EventSpraaysResponseDTO,
  EventSpraayResponseDTO,
  EventSpraayCreatedResponseDTO,
  CreateEventSpraayDTO,
} from './dto/event-spraay.dto';

@ApiBearerAuth('JWT')
@UseGuards(RolesGuard)
@ApiTags('event-spraay')
@Controller('event-spraay')
export class EventSpraayController {
  constructor(private readonly eventSpraaySrv: EventSpraayService) {}

  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: () => EventSpraayCreatedResponseDTO })
  @Post()
  async spraayCash(
    @Body() payload: CreateEventSpraayDTO,
    @CurrentUser(DecodedTokenKey.USER) user: User,
  ): Promise<EventSpraayCreatedResponseDTO> {
    return await this.eventSpraaySrv.spraayCash(payload, user);
  }

  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'eventId', required: false })
  @ApiQuery({ name: 'transactionId', required: false })
  @ApiResponse({ type: () => EventSpraaysResponseDTO })
  @Get()
  async findSpraays(
    @Query() payload: FindEventSpraaysDTO,
  ): Promise<EventSpraaysResponseDTO> {
    return await this.eventSpraaySrv.findSpraays(payload);
  }

  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: () => EventSpraayResponseDTO })
  @Get('/:spraayId')
  async findEventSpraayById(
    @Param('spraayId', ParseUUIDPipe) spraayId: string,
  ): Promise<EventSpraayResponseDTO> {
    return await this.eventSpraaySrv.findEventSpraayById(spraayId);
  }
}
