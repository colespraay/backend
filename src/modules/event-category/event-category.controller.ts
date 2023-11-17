import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  Body,
  UseGuards,
  ParseUUIDPipe,
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
import { EventCategoryService } from './event-category.service';
import {
  CreateEventCategoryDTO,
  EventCategoriesResponseDTO,
  EventCategoryResponseDTO,
  FindEventCategoryDTO,
} from './dto/event-category.dto';

@UseGuards(RolesGuard)
@ApiBearerAuth('JWT')
@ApiTags('event-category')
@Controller('event-category')
export class EventCategoryController {
  constructor(private readonly eventCategorySrv: EventCategoryService) {}

  @ApiOperation({ description: 'Create event category' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: EventCategoryResponseDTO })
  @Post()
  async createEventCategory(
    @Body() payload: CreateEventCategoryDTO,
    @CurrentUser(DecodedTokenKey.USER_ID) userId: string,
  ): Promise<EventCategoryResponseDTO> {
    return await this.eventCategorySrv.createEventCategory(payload, userId);
  }

  @ApiOperation({ description: 'Find event category by ID' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: EventCategoryResponseDTO })
  @Get('/:eventCategoryId')
  async findEventCategoryById(
    @Param('eventCategoryId', ParseUUIDPipe) eventCategoryId: string,
  ): Promise<EventCategoryResponseDTO> {
    return await this.eventCategorySrv.findEventCategoryById(eventCategoryId);
  }

  @ApiQuery({ name: 'searchTerm', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'pageNumber', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiOperation({ description: 'Find event categories' })
  @ApiProduces('json')
  @ApiConsumes('application/json')
  @ApiResponse({ type: EventCategoriesResponseDTO })
  @Get()
  async findEventCategories(
    @Query() payload: FindEventCategoryDTO,
  ): Promise<EventCategoriesResponseDTO> {
    return await this.eventCategorySrv.findEventCategories(payload);
  }
}
