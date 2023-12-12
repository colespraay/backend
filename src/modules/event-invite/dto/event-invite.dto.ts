import { ApiProperty } from '@nestjs/swagger';
import { BaseResponseTypeDTO, PaginationResponseType } from '@utils/index';
import { EventInvite } from '@entities/index';

export class CreateEventInvitesDTO {
  @ApiProperty()
  eventId: string;

  @ApiProperty({ type: () => [String] })
  userIds: string[];
}

export class EventInviteResponseDTO extends BaseResponseTypeDTO {
  @ApiProperty({ type: () => EventInvite })
  data: EventInvite;
}

export class CreatedEventInvitesResponseDTO extends BaseResponseTypeDTO {
  @ApiProperty({ type: () => [EventInvite] })
  data: EventInvite[];
}

export class EventInvitesResponseDTO extends BaseResponseTypeDTO {
  @ApiProperty({ type: () => [EventInvite] })
  data: EventInvite[];

  @ApiProperty({ type: () => PaginationResponseType, nullable: true })
  paginationControl?: PaginationResponseType;
}

export class DeleteEventInviteDTO {
  @ApiProperty({ type: () => [String] })
  eventInviteIds: string[];
}
