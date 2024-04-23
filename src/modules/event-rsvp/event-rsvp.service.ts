import {
  ConflictException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FindManyOptions } from 'typeorm';
import {
  calculatePaginationControls,
  checkForRequiredFields,
  compareEnumValueFields,
  sendEmail,
  validateUUIDField,
} from '@utils/index';
import { GenericService } from '@schematics/index';
import { EventRSVP } from '@entities/index';
import {
  CreateEventRSVPDTO,
  EventRSVPResponseDTO,
  EventRSVPStatus,
  EventRSVPsResponseDTO,
  FilterEventRSVPDTO,
} from './dto/event-rsvp.dto';

@Injectable()
export class EventRSVPService extends GenericService(EventRSVP) {
  private relations = ['user', 'event', 'event.user', 'event.eventRsvps'];

  async rsvpForEvent(
    payload: CreateEventRSVPDTO,
    userId: string,
  ): Promise<EventRSVPResponseDTO> {
    try {
      checkForRequiredFields(['eventId', 'status', 'userId'], {
        ...payload,
        userId,
      });
      validateUUIDField(payload.eventId, 'eventId');
      validateUUIDField(userId, 'userId');
      compareEnumValueFields(
        payload.status,
        Object.values(EventRSVPStatus),
        'status',
      );
      const rsvpRecord = await this.findOne({
        eventId: payload.eventId,
        userId,
      });
      if (rsvpRecord?.id) {
        const message = rsvpRecord.status
          ? 'User has already accepted this event'
          : 'User has already rejected this event';
        throw new ConflictException(message);
      }
      const status = payload.status === EventRSVPStatus.ACCEPTED ? true : false;
      const createdRecord = await this.create<Partial<EventRSVP>>({
        eventId: payload.eventId,
        status,
        userId,
      });
      await this.notifyEventOrganizerAfterRsvp(createdRecord.id);
      return {
        success: true,
        code: HttpStatus.CREATED,
        message: 'Created',
        data: createdRecord,
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async findEventRSVPById(eventRSVPId: string): Promise<EventRSVPResponseDTO> {
    try {
      checkForRequiredFields(['eventRSVPId'], { eventRSVPId });
      const record = await this.getRepo().findOne({
        where: { id: eventRSVPId },
        relations: this.relations,
      });
      if (!record?.id) {
        throw new NotFoundException('Event RSVP not found');
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

  async findEventRSVPs(
    filterOptions: FilterEventRSVPDTO,
  ): Promise<EventRSVPsResponseDTO> {
    try {
      const filter: FindManyOptions<EventRSVP> = {
        relations: this.relations,
      };
      if (
        typeof filterOptions.status !== 'undefined' &&
        filterOptions.status !== null
      ) {
        filter.where = { ...filter.where, status: filterOptions.status };
      }
      if (filterOptions?.userId) {
        validateUUIDField(filterOptions.userId, 'userId');
        filter.where = { ...filter.where, userId: filterOptions.userId };
      }
      if (filterOptions?.eventId) {
        validateUUIDField(filterOptions.eventId, 'eventId');
        filter.where = { ...filter.where, eventId: filterOptions.eventId };
      }
      if (filterOptions?.pageNumber && filterOptions?.pageSize) {
        filter.skip = (filterOptions.pageNumber - 1) * filterOptions.pageSize;
        filter.take = filterOptions.pageSize;
        const { response, paginationControl } =
          await calculatePaginationControls<EventRSVP>(this.getRepo(), filter, {
            pageNumber: filterOptions.pageNumber,
            pageSize: filterOptions.pageSize,
          });
        return {
          success: true,
          message: 'Records found',
          code: HttpStatus.OK,
          data: response,
          paginationControl,
        };
      }
      const users = await this.getRepo().find(filter);
      return {
        success: true,
        message: 'Records found',
        code: HttpStatus.OK,
        data: users,
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  private async notifyEventOrganizerAfterRsvp(
    eventRsvpId: string,
  ): Promise<void> {
    try {
      const rsvpRecord = await this.findEventRSVPById(eventRsvpId);
      const instagramUrl = String(process.env.INSTAGRAM_URL);
      const twitterUrl = String(process.env.TWITTER_URL);
      const facebookUrl = String(process.env.FACEBOOK_URL);
      const today = new Date();
      const event = rsvpRecord.data.event;
      const formattedDate = new Date(event.eventDate).toLocaleDateString(
        'en-US',
        {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        },
      );
      const rsvpUserFullName = `${rsvpRecord.data.user.firstName} ${rsvpRecord.data.user.lastName}`;
      const attendeeCount = [
        ...new Set(event.eventRsvps.map(({ userId }) => userId)),
      ];
      const html = `
      <section style="background: white; color: black; font-size: 15px; font-family: 'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif; display: flex; justify-content: center; margin: 0;">
      <div style="padding: 2rem; width: 80%;">
          <section style="text-align: center;">
              <div style="width: fit-content; margin: 20px 0px;display: inline-block;">
                  <img src="https://ik.imagekit.io/un0omayok/Logo%20animaion.png?updatedAt=1701281040423" alt="">
              </div>
          </section>
  
          <section style="width: 100%; height: auto; font-size: 18px; text-align: justify;">
              <p style="font-weight:300">Hi ${event.user.firstName},</p>
              <p style="font-weight:300">
                 Great news! Your friend <b>${rsvpUserFullName}(${
        rsvpRecord.data.user.userTag
      })</b> has accepted your invitation
                  join you at <b>${
                    event.eventTag
                  }</b> on Spraay App. Get ready for a fantastic celebration together!
              </p>
              <p style="font-weight:300">
                  Event Details:
              </p>
              <ul>
              <li>Date: <b>${formattedDate}</b></li>
              <li>Time: <b>${event.time}</b></li>
              <li>Event Code: <b>${event.eventCode}</b></li>
              <li>Expected Guests: <b>${attendeeCount.length ?? 0}</b></li>
          </ul>
  
              <p style="font-weight:300">
                 We can't wait to celebrate with you! Prepare for an unforgettable experience.
              </p>
  
              <p style="font-weight:300">
                  If you have any questions or need assistance, feel free to reach out.
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
      await sendEmail(html, 'User RSVP for Your Event', [
        rsvpRecord.data.event.user.email,
      ]);
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }
}
