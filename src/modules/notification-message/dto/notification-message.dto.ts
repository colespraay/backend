import { NotificationMessage } from '@entities/index';
import { ApiProperty } from '@nestjs/swagger';
import { BaseResponseTypeDTO, NotificationPurpose } from '@utils/index';

export class CreateNotificationMessageDTO {
  @ApiProperty()
  subject: string;

  @ApiProperty()
  message: string;

  @ApiProperty()
  html: string;

  @ApiProperty({ enum: NotificationPurpose })
  purpose: NotificationPurpose;

  @ApiProperty()
  userId: string;
}

export class NotificationMessageResponseDTO extends BaseResponseTypeDTO {
  @ApiProperty({ type: () => NotificationMessage })
  data: NotificationMessage;
}

export class NotificationMessagesResponseDTO extends BaseResponseTypeDTO {
  @ApiProperty({ type: () => [NotificationMessage] })
  data: NotificationMessage[];
}
