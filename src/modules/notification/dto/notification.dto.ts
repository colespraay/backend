import { ApiProperty } from '@nestjs/swagger';
import { Notification } from '@entities/index';
import {
  BaseResponseTypeDTO,
  PaginationRequestType,
  PaginationResponseType,
  UserNotificationType,
} from '@utils/index';

export class CreateNotificationDTO {
  @ApiProperty({ enum: UserNotificationType })
  type: UserNotificationType;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  subject: string;

  @ApiProperty()
  message: string;
}

export class FindNotificationDTO extends PaginationRequestType {
  @ApiProperty({ nullable: true })
  isRead: boolean;

  @ApiProperty({ nullable: true })
  status: boolean;

  @ApiProperty({ nullable: true })
  userId: string;

  @ApiProperty({ enum: UserNotificationType, nullable: true })
  type: UserNotificationType;
}

export class NotificationResponseDTO extends BaseResponseTypeDTO {
  @ApiProperty({ type: () => Notification })
  data: Notification;
}

export class NotificationsResponseDTO extends BaseResponseTypeDTO {
  @ApiProperty({ type: () => [Notification] })
  data: Notification[];

  @ApiProperty({ type: () => PaginationResponseType })
  paginationControl?: PaginationResponseType;
}
