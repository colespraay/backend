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
  NumberResponseDTO,
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
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiQuery({ name: 'pageNumber', required: false })
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

  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: () => NumberResponseDTO })
  @Get('/total-amount-sprayed-at-event/:eventId')
  async findTotalSpraaysPerEvent(
    @Param('eventId', ParseUUIDPipe) eventId: string,
  ): Promise<NumberResponseDTO> {
    return await this.eventSpraaySrv.findTotalSpraaysPerEvent(eventId);
  }

  // @Get('aggregate-total-sum-per-day')
  // @ApiResponse({
  //   status: 200,
  //   description: 'Successfully aggregated total event spraay sum per day for the past 10 days',
  // })
  // @ApiResponse({
  //   status: 500,
  //   description: 'Failed to aggregate total event spraay sum per day',
  // })
  // async aggregateTotalEventSpraaySumPerDay(): Promise<any> {
  //   return this.eventSpraayService.aggregateTotalEventSpraaySumPerDay();
  // }

  @Get('admin/aggregate-total-sum-per-day')
  @ApiResponse({
    status: 200,
    description: 'Successfully aggregated total event spraay sum per day for the past 10 days',
  })
  @ApiResponse({
    status: 500,
    description: 'Failed to aggregate total event spraay sum per day',
  })
  async aggregateTotalEventSpraaySumPerDay(): Promise<any> {
    return this.eventSpraaySrv.aggregateTotalEventSpraaySumPerDay();
  }
}
