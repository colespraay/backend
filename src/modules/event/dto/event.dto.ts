import { ApiProperty, PartialType } from '@nestjs/swagger';
import { EventRecord } from '@entities/index';
import {
  BaseResponseTypeDTO,
  EventCategory,
  PaginationResponseType,
} from '@utils/index';

export class GeoCoordinateDTO {
  @ApiProperty()
  longitude: number;

  @ApiProperty()
  latitude: number;
}

export class CreateEventDTO {
  @ApiProperty()
  eventName: string;

  @ApiProperty()
  eventDescription: string;

  @ApiProperty()
  venue: string;

  @ApiProperty()
  eventDate: Date;

  @ApiProperty()
  time: string;

  @ApiProperty({ enum: EventCategory })
  category: EventCategory;

  @ApiProperty()
  eventCoverImage: string;

  @ApiProperty({ nullable: true })
  eventGeoCoordinates: GeoCoordinateDTO;
}

export class UpdateEventDTO extends PartialType(CreateEventDTO) {
  @ApiProperty()
  eventId: string;

  @ApiProperty({ nullable: true })
  status?: boolean;
}

export class FilterEventDTO {
  @ApiProperty({ nullable: true })
  userId: string;

  @ApiProperty({ enum: EventCategory, nullable: true })
  category: EventCategory;

  @ApiProperty({ nullable: true })
  searchTerm: string;

  @ApiProperty({ nullable: true })
  status: boolean;
}

export class EventResponseDTO extends BaseResponseTypeDTO {
  @ApiProperty({ type: () => EventRecord })
  data: EventRecord;
}

export class EventsResponseDTO extends BaseResponseTypeDTO {
  @ApiProperty({ type: () => [EventRecord] })
  data: EventRecord[];

  @ApiProperty({ type: () => PaginationResponseType, nullable: true })
  paginationControl?: PaginationResponseType;
}

export class DeleteEventDTO {
  @ApiProperty({ type: () => [String] })
  eventIds: string[];
}

export class EventCategoryResponseDTO extends BaseResponseTypeDTO {
  @ApiProperty({ type: () => [String] })
  data: string[];
}
