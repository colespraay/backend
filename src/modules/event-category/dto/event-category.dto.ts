import { ApiProperty } from '@nestjs/swagger';
import { EventCategory } from '@entities/index';
import {
  BaseResponseTypeDTO,
  PaginationRequestType,
  PaginationResponseType,
} from '@utils/index';

export class CreateEventCategoryDTO {
  @ApiProperty()
  name: string;
}

export class FindEventCategoryDTO extends PaginationRequestType {
  @ApiProperty({ nullable: true })
  searchTerm: string;

  @ApiProperty({ nullable: true })
  status: boolean;

  @ApiProperty({ nullable: true })
  userId: string;
}

export class EventCategoryResponseDTO extends BaseResponseTypeDTO {
  @ApiProperty({ type: () => EventCategory })
  data: EventCategory;
}

export class EventCategoriesResponseDTO extends BaseResponseTypeDTO {
  @ApiProperty({ type: () => [EventCategory] })
  data: EventCategory[];

  @ApiProperty({ type: () => PaginationResponseType, nullable: true })
  paginationControl?: PaginationResponseType;
}
