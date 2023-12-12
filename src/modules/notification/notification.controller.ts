import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RolesGuard } from '@schematics/index';
import { UserNotificationType } from '@utils/index';
import { NotificationService } from './notification.service';
import {
  FindNotificationDTO,
  NotificationResponseDTO,
  NotificationsResponseDTO,
} from './dto/notification.dto';

@UseGuards(RolesGuard)
@ApiBearerAuth('JWT')
@ApiTags('notification')
@Controller('notification')
export class NotificationController {
  constructor(private readonly notificationSrv: NotificationService) {}

  @ApiQuery({ name: 'pageSize', required: false })
  @ApiQuery({ name: 'pageNumber', required: false })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'status', required: false, type: Boolean })
  @ApiQuery({ name: 'isRead', required: false, type: Boolean })
  @ApiQuery({ enum: UserNotificationType, name: 'type', required: false })
  @ApiOperation({ description: 'Find notifications' })
  @ApiResponse({ type: () => NotificationsResponseDTO })
  @Get()
  async findNotifications(
    @Query() payload: FindNotificationDTO,
  ): Promise<NotificationsResponseDTO> {
    return await this.notificationSrv.findNotifications(payload);
  }

  @ApiOperation({ description: 'Find notification by Id' })
  @ApiResponse({ type: () => NotificationResponseDTO })
  @Get('/:notificationId')
  async findNotificationById(
    @Param('notificationId', ParseUUIDPipe) notificationId: string,
  ): Promise<NotificationResponseDTO> {
    return await this.notificationSrv.findNotificationById(notificationId);
  }
}
