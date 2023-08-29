import { ApiProperty } from '@nestjs/swagger';
import { EventRSVP } from '@entities/index';
import {
  BaseResponseTypeDTO,
  PaginationRequestType,
  PaginationResponseType,
} from '@utils/index';

export enum EventRSVPStatus {
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
}

export class CreateEventRSVPDTO {
  @ApiProperty()
  eventId: string;

  @ApiProperty({ enum: EventRSVPStatus })
  status: EventRSVPStatus;
}

export class EventRSVPResponseDTO extends BaseResponseTypeDTO {
  @ApiProperty({ type: () => EventRSVP })
  data: EventRSVP;
}

export class EventRSVPsResponseDTO extends BaseResponseTypeDTO {
  @ApiProperty({ type: () => [EventRSVP] })
  data: EventRSVP[];

  @ApiProperty({ type: () => PaginationResponseType, nullable: true })
  paginationControl?: PaginationResponseType;
}

export class FilterEventRSVPDTO extends PaginationRequestType {
  @ApiProperty({ nullable: true })
  userId: string;

  @ApiProperty({ nullable: true })
  eventId: string;

  @ApiProperty({ nullable: true })
  status: boolean;
}
