import { ApiProperty } from '@nestjs/swagger';
import { EventSpraay } from '@entities/index';
import {
  BaseResponseTypeDTO,
  PaginationRequestType,
  PaginationResponseType,
} from '@utils/index';

export class CreateEventSpraayDTO {
  @ApiProperty()
  amount: number;

  @ApiProperty()
  eventId: string;

  @ApiProperty()
  transactionPin: string;
}

export class EmmitEventSpraayDTO {
  @ApiProperty()
  amount: number;

  @ApiProperty()
  sprayerName: number;

  @ApiProperty()
  receiver: string;

  @ApiProperty()
  sprayerId: string;

  @ApiProperty()
  eventId: string;

  @ApiProperty()
  transactionPin: string;
}

export class EmmitEventSpraayDTOReal {
  @ApiProperty()
  amount: number;

  @ApiProperty()
  sprayerName: number;

  @ApiProperty()
  receiver: string;

  @ApiProperty()
  sprayerId: string;

  @ApiProperty()
  eventId: string;

  @ApiProperty()
  transactionPin: string;

  autoId: string
}

export class EventSpraayCreatedResponseDTO extends BaseResponseTypeDTO {
  @ApiProperty({ type: () => EventSpraay })
  data: EventSpraay;

  @ApiProperty()
  eventCode: string;

  @ApiProperty()
  transactionReference: string;
}

export class EventSpraayResponseDTO extends BaseResponseTypeDTO {
  @ApiProperty({ type: () => EventSpraay })
  data: EventSpraay;
}

export class EventSpraaysResponseDTO extends BaseResponseTypeDTO {
  @ApiProperty({ type: () => [EventSpraay] })
  data: EventSpraay[];

  @ApiProperty({ type: () => PaginationResponseType, nullable: true })
  paginationControl?: PaginationResponseType;
}

export class FindEventSpraaysDTO extends PaginationRequestType {
  @ApiProperty({ nullable: true })
  userId: string;

  @ApiProperty({ nullable: true })
  eventId: string;

  @ApiProperty({ nullable: true })
  transactionId: string;
}

export class NumberResponseDTO extends BaseResponseTypeDTO {
  @ApiProperty()
  total: number;
}
