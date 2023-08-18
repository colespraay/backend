import { Injectable } from '@nestjs/common';
import { NotificationMessage } from '@entities/index';
import { GenericService } from '@schematics/index';

@Injectable()
export class NotificationMessageService extends GenericService(
  NotificationMessage,
) {}
