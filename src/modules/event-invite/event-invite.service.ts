import {
  BadRequestException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventInvite } from '@entities/index';
import { GenericService } from '@schematics/index';
import {
  BaseResponseTypeDTO,
  NotificationPurpose,
  UserNotificationType,
  checkForRequiredFields,
  validateArrayField,
  validateArrayUUIDField,
  validateUUIDField,
} from '@utils/index';
import { In } from 'typeorm';
import {
  CreateEventInvitesDTO,
  EventInviteResponseDTO,
  CreatedEventInvitesResponseDTO,
} from './dto/event-invite.dto';
import { EventService, UserService } from '../index';

@Injectable()
export class EventInviteService extends GenericService(EventInvite) {
  constructor(
    private readonly userSrv: UserService,
    private readonly eventEmitter: EventEmitter2,
    private readonly eventSrv: EventService,
  ) {
    super();
  }

  async createEventInvites(
    payload: CreateEventInvitesDTO,
  ): Promise<CreatedEventInvitesResponseDTO> {
    try {
      checkForRequiredFields(['userIds', 'eventId'], payload);
      validateArrayField(payload.userIds, 'userIds', true);
      validateArrayUUIDField(payload.userIds, 'userIds');
      const userIdsWithoutDuplicates = [...new Set(payload.userIds)];
      const event = await this.eventSrv.getRepo().findOne({
        where: { id: payload.eventId },
        relations: ['user'],
      });
      if (!event?.id) {
        throw new NotFoundException('Event not found');
      }
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
      await this.sendInviteNotifications(createdInvites, payload.eventId);
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

  private async sendInviteNotifications(
    createdInvites: EventInvite[],
    eventId: string,
  ): Promise<void> {
    try {
      const today = new Date();
      const instagramUrl = String(process.env.INSTAGRAM_URL);
      const twitterUrl = String(process.env.TWITTER_URL);
      const facebookUrl = String(process.env.FACEBOOK_URL);
      const users = await this.userSrv.getRepo().find({
        where: { id: In(createdInvites.map(({ userId }) => userId)) },
      });
      const organizedEvent = await this.eventSrv.findEventById(eventId);
      const event = organizedEvent.data;
      const subject = `Invitation To Event ${event.eventTag} - ${event.eventName}`;
      const formattedDate = new Date(
        organizedEvent.data.eventDate,
      ).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      const inviteTemplates = createdInvites.map((invite) => {
        const user = users.find((user) => user.id === invite.id);
        const html = `
            <section style="background: white; color: black; font-size: 15px; font-family: 'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif; display: flex; justify-content: center; margin: 0;">
                <div style="padding: 2rem; width: 80%;">
                    <section style="text-align: center;">
                        <div style="width: fit-content; margin: 20px 0px;display: inline-block;">
                            <img src="https://ik.imagekit.io/un0omayok/Logo%20animaion.png?updatedAt=1701281040423" alt="">
                        </div>
                    </section>
            
                    <section style="width: 100%; height: auto; font-size: 18px; text-align: justify;">
                        <p style="font-weight:300">Hi ${user.firstName},</p>
                        <p style="font-weight:300">
                          Exciting news!
                        </p>
                        <b style="font-weight:300">
                            Your friend <b>${
                              organizedEvent.data.user.firstName
                            }</b> has invited you to <b>${
          organizedEvent.data.eventTag
        } - ${organizedEvent.data.eventName}</b> on Spraay App.
                        </p>
            
                        <ul>
                            <li>Date: <b>${formattedDate}</b></li>
                            <li>Event Code: <b>${
                              organizedEvent.data.eventCode
                            }</b></li>
                            <li>Venue: <b>${organizedEvent.data.venue}</b></li>
                        </ul>
                        <p style="font-weight:300">
                            Are you attending?
                        </p>
                    </section>
            
                    <section style="text-align: center; height: 8rem; background-color: #5B45FF; border-radius: 10px; margin-top: 2rem; margin-bottom: 2rem;">
                      <a href="${instagramUrl}" style="margin-right: 30px;display: inline-block;padding-top:40px;"><img src="https://ik.imagekit.io/un0omayok/mdi_instagram.png?updatedAt=1701281040417" alt=""></a>
                      <a href="${twitterUrl}" style="margin-right: 30px;display: inline-block;padding-top:40px;"><img src="https://ik.imagekit.io/un0omayok/simple-icons_x.png?updatedAt=1701281040408" alt=""></a>
                      <a href="${facebookUrl}" style="display: inline-block;padding-top:40px;"><img src="https://ik.imagekit.io/un0omayok/ic_baseline-facebook.png?updatedAt=1701281040525" alt=""></a>
                    </section>
            
                    <section style="padding: 20px; border-bottom: 2px solid #000; text-align: center; font-size: 20px;">
                        <p style="font-weight:300">Spraay software limited</p>
                    </section>
            
                    <section style="text-align: center; font-size: 18px;">
                        <p style="font-weight: 400;">Spraay &copy;${today.getFullYear()}</p>
                        <p style="font-weight: 400;">Click here to <a href="#" style="color: #5B45FF;">Unsubscribe</a></p>
                    </section>
                </div>
            </section>
          `;
        return {
          subject,
          message: `You are invited to ${event.eventTag} - ${event.eventName}`,
          html,
          purpose: NotificationPurpose.EVENT_INVITE,
          userId: invite.userId,
        };
      });
      this.eventEmitter.emit('notification.created', inviteTemplates);
      createdInvites.forEach((invite) => {
        this.eventEmitter.emit('user-notification.create', {
          userId: invite.userId,
          subject: 'Event invite',
          type: UserNotificationType.USER_SPECIFIC,
          message: `You are invited to ${event.eventName}`,
        });
      });
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async getAllEventInvites(): Promise<EventInvite[]> {
    return await this.getRepo().find(); // No relations option needed
  }
}
