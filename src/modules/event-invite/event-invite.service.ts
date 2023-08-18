import {
  BadRequestException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventInvite } from '@entities/index';
import { GenericService } from '@schematics/index';
import {
  CreateEventInvitesDTO,
  EventInviteResponseDTO,
  CreatedEventInvitesResponseDTO,
} from './dto/event-invite.dto';
import {
  BaseResponseTypeDTO,
  checkForRequiredFields,
  validateArrayField,
  validateArrayUUIDField,
  validateUUIDField,
} from '@utils/index';
import { In } from 'typeorm';

@Injectable()
export class EventInviteService extends GenericService(EventInvite) {
  async createEventInvites(
    payload: CreateEventInvitesDTO,
  ): Promise<CreatedEventInvitesResponseDTO> {
    try {
      checkForRequiredFields(['userIds', 'eventId'], payload);
      validateArrayField(payload.userIds, 'userIds', true);
      validateArrayUUIDField(payload.userIds, 'userIds');
      const userIdsWithoutDuplicates = [...new Set(payload.userIds)];
      const record = await this.getRepo().find({
        where: {
          eventId: payload.eventId,
          userId: In(userIdsWithoutDuplicates),
        },
        select: ['id', 'userId'],
      });
      if (record?.length > 0) {
        const recordUserIds = record.map(({ userId }) => userId);
        const duplicateIds = userIdsWithoutDuplicates.filter((id) =>
          recordUserIds.includes(id),
        );
        if (duplicateIds?.length > 0) {
          throw new BadRequestException(
            `${duplicateIds.length} users have already been invited for event`,
          );
        }
      }
      const createdInvites = await this.createMany<Partial<EventInvite>>(
        payload.userIds.map((userId) => ({ userId, eventId: payload.eventId })),
      );
      // TODO: Send out invites here [User async events here]
      return {
        success: true,
        code: HttpStatus.CREATED,
        message: 'Created',
        data: createdInvites,
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async findEventInviteById(
    eventInviteId: string,
  ): Promise<EventInviteResponseDTO> {
    try {
      checkForRequiredFields(['eventInviteId'], { eventInviteId });
      const record = await this.getRepo().findOne({
        where: { id: eventInviteId },
      });
      if (!record?.id) {
        throw new NotFoundException();
      }
      return {
        success: true,
        code: HttpStatus.OK,
        message: 'Record found',
        data: record,
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async deleteEventInvites(
    eventInviteIds: string[],
  ): Promise<BaseResponseTypeDTO> {
    try {
      checkForRequiredFields(['eventInviteIds'], { eventInviteIds });
      eventInviteIds?.forEach((eventInviteId, index) => {
        validateUUIDField(eventInviteId, `eventInviteId${[index]}`);
      });
      await this.validateDataToDelete(
        { id: In(eventInviteIds) },
        eventInviteIds,
      );
      await this.delete({ id: In(eventInviteIds) });
      return {
        success: true,
        code: HttpStatus.OK,
        message: 'Deleted',
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }
}
