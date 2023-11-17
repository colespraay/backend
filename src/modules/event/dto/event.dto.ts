import { ApiProperty, PartialType } from '@nestjs/swagger';
import { EventRecord } from '@entities/index';
import {
  BaseResponseTypeDTO,
  EventStatus,
  PaginationRequestType,
  PaginationResponseType,
} from '@utils/index';

export class GeoCoordinateDTO {
  @ApiProperty({ type: () => Number })
  longitude: number;

  @ApiProperty({ type: () => Number })
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

  @ApiProperty()
  eventCategoryId: string;

  @ApiProperty()
  eventCoverImage: string;

  @ApiProperty({ nullable: true })
  eventGeoCoordinates: GeoCoordinateDTO;
}

export class UpdateEventDTO extends PartialType(CreateEventDTO) {
  @ApiProperty()
  eventId: string;

  @ApiProperty({ enum: EventStatus, nullable: true })
  eventStatus?: EventStatus;

  @ApiProperty({ nullable: true })
  status?: boolean;
}

export class FilterEventDTO {
  @ApiProperty({ nullable: true })
  userId: string;

  @ApiProperty({ nullable: true })
  eventCategoryId: string;

  @ApiProperty({ enum: EventStatus, nullable: true })
  eventStatus: EventStatus;

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

export class FilterForCurrentUserDTO extends PaginationRequestType {
  @ApiProperty({ enum: EventStatus })
  eventStatus: EventStatus;
}

export class EventAttendanceSummaryPartial {
  @ApiProperty()
  totalPeopleInvited: number;

  @ApiProperty()
  totalRsvp: number;
}

export class EventAttendanceSummaryDTO extends BaseResponseTypeDTO {
  @ApiProperty({ type: () => EventAttendanceSummaryPartial })
  data: EventAttendanceSummaryPartial;
}
