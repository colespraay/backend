import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Between, FindManyOptions } from 'typeorm';
import { EventSpraay, User } from '@entities/index';
import { GenericService } from '@schematics/index';
import {
  TransactionType,
  UserNotificationType,
  calculateAppCut,
  calculatePaginationControls,
  checkForRequiredFields,
  formatAmount,
  generateUniqueCode,
  sendEmail,
  validateUUIDField,
} from '@utils/index';
import { TransactionService } from '@modules/transaction/transaction.service';
import { EventService, UserService, WalletService } from '../index';
import {
  EventSpraayResponseDTO,
  CreateEventSpraayDTO,
  EventSpraayCreatedResponseDTO,
  EventSpraaysResponseDTO,
  FindEventSpraaysDTO,
  NumberResponseDTO,
} from './dto/event-spraay.dto';
import { TransactionDateRangeDto } from '@modules/transaction/dto/transaction.dto';

@Injectable()
export class EventSpraayService extends GenericService(EventSpraay) {
  constructor(
    private readonly userSrv: UserService,
    private readonly eventSrv: EventService,
    @Inject(forwardRef(() => WalletService))
    private readonly walletSrv: WalletService,
    @Inject(forwardRef(() => TransactionService))
    private readonly transactionSrv: TransactionService,
    private readonly eventEmitterSrv: EventEmitter2,
  ) {
    super();
  }

  async spraayCash(
    payload: CreateEventSpraayDTO,
    user: User,
  ): Promise<EventSpraayCreatedResponseDTO> {
    checkForRequiredFields(['userId', 'eventId', 'amount', 'transactionPin'], {
      ...payload,
      userId: user.id,
    });
    validateUUIDField(payload.eventId, 'eventId');
    payload.amount = Number(payload.amount);
    const isPinValid = await this.userSrv.verifyTransactionPin(
      user.id,
      payload.transactionPin,
    );
    if (!isPinValid?.success) {
      throw new BadRequestException('Invalid transaction pin');
    }
    await this.userSrv.checkAccountBalance(payload.amount, user.id);
    const event = await this.eventSrv.findEventById(payload.eventId);
    if (event.data.userId === user.id) {
      throw new ConflictException('Cannot spraay at your own event');
    }
    const currentWalletBalance = await this.userSrv.getCurrentWalletBalance(
      user.id,
    );
    // Also handles the debit of user's wallet
    const transactionDate = new Date().toLocaleString();
    const narration = `₦${payload.amount} 'spraayed' for  ${event.data?.user?.firstName} ${event.data?.user?.lastName}`;
    const reference = `Spraay-${generateUniqueCode(10)}`;
    const newTransaction = await this.transactionSrv.createTransaction({
      reference,
      transactionDate,
      currentBalanceBeforeTransaction: currentWalletBalance,
      type: TransactionType.DEBIT,
      userId: user.id,
      amount: payload.amount,
      narration,
    });
    // Credit account
    this.logger.debug({ newTransaction });
    const newSpraay = await this.create<Partial<EventSpraay>>({
      ...payload,
      userId: user.id,
      transactionId: newTransaction.data.id,
    });

    const recipientCurrentBalance = await this.userSrv.getCurrentWalletBalance(
      event.data.userId,
    );
    const amountWithoutAppCut = calculateAppCut(5, payload.amount);
    const appCut = payload.amount - amountWithoutAppCut;
    const formattedAmount = formatAmount(payload.amount);
    const recipientNarration = `₦${formatAmount(amountWithoutAppCut)} was 'spraayed' on you by ${user.firstName} ${user.lastName}`;
    const creditTransaction = await this.transactionSrv.createTransaction({
      reference,
      transactionDate,
      currentBalanceBeforeTransaction: recipientCurrentBalance,
      amount: amountWithoutAppCut,
      narration: recipientNarration,
      type: TransactionType.CREDIT,
      userId: event.data.userId,
    });
    this.logger.debug({ creditTransaction });
    // Log amount app earns from the transaction
    this.eventEmitterSrv.emit('app-profit.log', {
      amount: appCut,
      transactionId: creditTransaction.data.id,
    });

    const senderNarration = `You 'spraayed' ₦${payload.amount} at '${event.data.eventName}'`;
    const debitTransaction = await this.transactionSrv.createTransaction({
      reference,
      transactionDate,
      userId: user.id,
      amount: payload.amount,
      type: TransactionType.DEBIT,
      narration: senderNarration,
      // receiverUserId: event.data.userId,
      currentBalanceBeforeTransaction: currentWalletBalance,
    });
    this.logger.debug({ debitTransaction });

    await this.sendNotificationAfterSpraying(newSpraay.id);

    this.eventEmitterSrv.emit('user-notification.create', {
      userId: event.data.userId,
      subject: 'Cash sprayed',
      type: UserNotificationType.USER_SPECIFIC,
      message: `You were sprayed with ₦${formattedAmount} by ${user.firstName} ${user.lastName}`,
    });

    this.eventEmitterSrv.emit('user-notification.create', {
      userId: user.id,
      subject: 'Cash sprayed',
      type: UserNotificationType.USER_SPECIFIC,
      message: `You sprayed ₦${formattedAmount} on ${event.data?.user?.firstName} ${event.data?.user?.lastName}`,
    });

    return {
      success: true,
      data: newSpraay,
      code: HttpStatus.CREATED,
      eventCode: event.data.eventCode,
      transactionReference: newTransaction.data.reference,
      message: `₦${payload.amount.toLocaleString()} cash sprayed`,
    };
  }

  async findEventSpraayById(spraayId: string): Promise<EventSpraayResponseDTO> {
    try {
      checkForRequiredFields(['spraayId'], { spraayId });
      const record = await this.getRepo().findOne({
        where: { id: spraayId },
      });
      if (!record?.id) {
        throw new NotFoundException();
      }
      return {
        success: true,
        code: HttpStatus.OK,
        data: record,
        message: 'Record found',
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async findSpraays(
    payload: FindEventSpraaysDTO,
  ): Promise<EventSpraaysResponseDTO> {
    try {
      const filter: FindManyOptions<EventSpraay> = {};
      if (payload.eventId) {
        validateUUIDField(payload.eventId, 'eventId');
        filter.where = { ...filter.where, eventId: payload.eventId };
      }
      if (payload.userId) {
        validateUUIDField(payload.userId, 'userId');
        filter.where = { ...filter.where, userId: payload.userId };
      }
      if (payload.transactionId) {
        validateUUIDField(payload.transactionId, 'transactionId');
        filter.where = {
          ...filter.where,
          transactionId: payload.transactionId,
        };
      }
      if (payload?.pageNumber && payload?.pageSize) {
        filter.skip = (payload.pageNumber - 1) * payload.pageSize;
        filter.take = payload.pageSize;
        const { response, paginationControl } =
          await calculatePaginationControls<EventSpraay>(
            this.getRepo(),
            filter,
            {
              pageNumber: payload.pageNumber,
              pageSize: payload.pageSize,
            },
          );
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

  async findTotalSpraaysPerEvent(eventId: string): Promise<NumberResponseDTO> {
    try {
      checkForRequiredFields(['eventId'], { eventId });
      const records = await this.getRepo().find({
        where: { eventId },
        relations: ['transaction'],
      });
      const numbers = records.map(({ transaction }) => transaction.amount);
      const total = numbers.reduce((curr, next) => curr + next, 0);
      return {
        success: true,
        code: HttpStatus.OK,
        message: 'Total found',
        total,
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  private async sendNotificationAfterSpraying(
    eventSpraayId: string,
  ): Promise<void> {
    try {
      const sprayRecord = await this.getRepo().findOne({
        where: { id: eventSpraayId },
        relations: ['transaction', 'event', 'event.user'],
      });
      if (sprayRecord?.id) {
        const today = new Date();
        const formattedDate = new Date(
          sprayRecord.dateCreated,
        ).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
        const instagramUrl = String(process.env.INSTAGRAM_URL);
        const twitterUrl = String(process.env.TWITTER_URL);
        const facebookUrl = String(process.env.FACEBOOK_URL);
        const html = `<section style="background: white; color: black; font-size: 15px; font-family: 'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif; display: flex; justify-content: center; margin: 0;">
        <div style="padding: 2rem; width: 80%;">
            <section style="text-align: center;">
                <div style="width: fit-content; margin: 20px 0px;display: inline-block;">
                    <img src="https://ik.imagekit.io/un0omayok/Logo%20animaion.png?updatedAt=1701281040423" alt="">
                </div>
            </section>
    
            <section style="width: 100%; height: auto; font-size: 18px; text-align: justify;">
                <p style="font-weight:300">Hi ${
                  sprayRecord.event?.user?.firstName
                },</p>
                <p style="font-weight:300">
                  Your guests are truly embracing the joyous atmosphere you've created!
                </p>
                <p style="font-weight:300">
                    One of your invited guests has engaged in the celebration by spraying cash at <b>${
                      sprayRecord.event.eventTag
                    }</b> 
                    using Spraay App.
                </p>
                <p style="font-weight:300">
                    Thank you for choosing Spraay App to enhance your event experience.
                </p>
                <h6 style="text-align: center; margin: 0;">Spraay Amount</h6>
                <h1 style="text-align: center; font-size: 50px; margin: 0; color: #49E17F;">
                <span style="font-size: 30px;">+</span>
                ₦${sprayRecord.amount.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                })}
                </h1>
    
                <table style="width: 100%;padding: 10px 0">
                    <tbody>
                        <tr>
                            <td style="text-align: left;padding: 15px;border-bottom: 1px solid #ccc;">Event Name</td>
                            <td style="text-align: right;padding: 15px;border-bottom: 1px solid #ccc;">
                              ${sprayRecord.event.eventName}
                            </td>
                        </tr>
                        <tr>
                            <td style="text-align: left;padding: 15px;border-bottom: 1px solid #ccc;">
                                Transaction Date
                            </td>
                            <td style="text-align: right;padding: 15px;border-bottom: 1px solid #ccc;">
                              ${formattedDate}
                            </td>
                        </tr>
                        <tr>
                            <td style="text-align: left;padding: 15px;border-bottom: 1px solid #ccc;">
                                Transaction Reference
                            </td>
                            <td style="text-align: right;padding: 15px;border-bottom: 1px solid #ccc;">
                              ${sprayRecord.transaction.reference}
                            </td>
                        </tr>
                    </tbody>
                </table>
    
                <p style="padding-bottom: 50px;font-weight:300;border-bottom: 1px solid #ccc;">
                    Thank you for choosing Spraay App to enhance your event experience!
                </p>
    
                <p style="font-weight:300">
                    If you have any issues with payment, kindly reply to this email or send an 
                    email to  <span style="font-weight: 400;">
                        <a href="mailto:hello@spraay.ng" style="color: inherit;">hello@spraay.ng.</a>
                    </span>
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
        await sendEmail(html, 'Money Sprayed At Your Event', [
          sprayRecord.event.user.email,
        ]);
      }
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  // async aggregateTotalEventSpraaySumPerDay(): Promise<any> {
  //   try {
  //     const currentDate = new Date();
  //     const startDate = new Date(currentDate.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 days ago

  //     // Format start and end dates to match the transaction date format
  //     const startDateISO = startDate.toISOString().split('T')[0];
  //     const currentDateISO = currentDate.toISOString().split('T')[0];

  //     const eventSpraays = await this.eventSpraayRepository.find({
  //       where: {
  //         createdAt: Between(startDateISO, currentDateISO),
  //       },
  //     });

  //     const aggregatedData = {};

  //     eventSpraays.forEach((eventSpraay) => {
  //       // Get the date part from the eventSpraay createdAt timestamp
  //       const dateKey = eventSpraay.createdAt.toISOString().split('T')[0];

  //       if (!aggregatedData[dateKey]) {
  //         aggregatedData[dateKey] = 0;
  //       }

  //       aggregatedData[dateKey] += eventSpraay.amount;
  //     });

  //     // Fill in 0 for days with no data in the past 10 days
  //     for (let i = 0; i < 10; i++) {
  //       const dateKey = new Date(currentDate.getTime() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  //       if (!aggregatedData[dateKey]) {
  //         aggregatedData[dateKey] = 0;
  //       }
  //     }

  //     return {
  //       success: true,
  //       message: 'Total event spraay sum aggregated per day for the past 10 days',
  //       code: HttpStatus.OK,
  //       data: aggregatedData,
  //     };
  //   } catch (error) {
  //     console.error('Error in aggregateTotalEventSpraaySumPerDay:', error);

  //     return {
  //       success: false,
  //       message: 'Failed to aggregate total event spraay sum per day',
  //       code: HttpStatus.INTERNAL_SERVER_ERROR,
  //       error: error.message,
  //     };
  //   }
  // }
  // async aggregateTotalEventSpraaySumPerDay(dateRangeDto: TransactionDateRangeDto): Promise<any> {
  //   try {
  //     const { startDate, endDate } = dateRangeDto;
  
  //     // Fetch event spraays within the specified date range
  //     const eventSpraays = await this.getRepo().find({
  //       where: {
  //         dateCreated: Between(startDate, endDate),
  //       },
  //     });
  
  //     const aggregatedData = {};
  
  //     eventSpraays.forEach((eventSpraay) => {
  //       // Get the date part from the eventSpraay dateCreated timestamp
  //       const dateKey = eventSpraay.dateCreated.toISOString().split('T')[0];
  
  //       if (!aggregatedData[dateKey]) {
  //         aggregatedData[dateKey] = 0;
  //       }
  
  //       aggregatedData[dateKey] += eventSpraay.amount;
  //     });
  
  //     // Fill in 0 for days with no data in the specified date range
  //     const start = new Date(startDate);
  //     const end = new Date(endDate);
  //     const daysInRange = Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  
  //     for (let i = 0; i <= daysInRange; i++) {
  //       const dateKey = new Date(start.getTime() + i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  //       if (!aggregatedData[dateKey]) {
  //         aggregatedData[dateKey] = 0;
  //       }
  //     }
  
  //     // Sort the date keys chronologically
  //     const sortedKeys = Object.keys(aggregatedData).sort();
  
  //     // Format the date keys in the expected format "YYYY-MM-DD"
  //     const formattedData = {};
  //     sortedKeys.forEach((date) => {
  //       formattedData[date] = aggregatedData[date];
  //     });
  
  //     return {
  //       success: true,
  //       message: 'Total event spraay sum aggregated per day for the specified date range',
  //       code: HttpStatus.OK,
  //       data: formattedData,
  //     };
  //   } catch (error) {
  //     console.error('Error in aggregateTotalEventSpraaySumPerDay:', error);
  
  //     return {
  //       success: false,
  //       message: 'Failed to aggregate total event spraay sum per day',
  //       code: HttpStatus.INTERNAL_SERVER_ERROR,
  //       error: error.message,
  //     };
  //   }
  // }

  async aggregateTotalEventSpraaySumPerDay(dateRangeDto: TransactionDateRangeDto): Promise<any> {
    try {
      const { startDate, endDate } = dateRangeDto;
  
      // Fetch event spraays within the specified date range
      const eventSpraays = await this.getRepo().find({
        where: {
          dateCreated: Between(startDate, endDate),
        },
      });
  
      const aggregatedData = {};
      let totalCount = 0;
  
      eventSpraays.forEach((eventSpraay) => {
        // Get the date part from the eventSpraay dateCreated timestamp
        const dateKey = eventSpraay.dateCreated.toISOString().split('T')[0];
  
        if (!aggregatedData[dateKey]) {
          aggregatedData[dateKey] = 0;
        }
  
        aggregatedData[dateKey] += eventSpraay.amount;
        totalCount++;
      });
  
      // Fill in 0 for days with no data in the specified date range
      const start = new Date(startDate);
      const end = new Date(endDate);
      const daysInRange = Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  
      for (let i = 0; i <= daysInRange; i++) {
        const dateKey = new Date(start.getTime() + i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
        if (!aggregatedData[dateKey]) {
          aggregatedData[dateKey] = 0;
        }
      }
  
      // Sort the date keys chronologically
      const sortedKeys = Object.keys(aggregatedData).sort();
  
      // Format the date keys in the expected format "YYYY-MM-DD"
      const formattedData = {};
      sortedKeys.forEach((date) => {
        formattedData[date] = aggregatedData[date];
      });
  
      return {
        success: true,
        message: 'Total event spraay sum aggregated per day for the specified date range',
        code: HttpStatus.OK,
        data: formattedData,
        totalCount,
      };
    } catch (error) {
      console.error('Error in aggregateTotalEventSpraaySumPerDay:', error);
  
      return {
        success: false,
        message: 'Failed to aggregate total event spraay sum per day',
        code: HttpStatus.INTERNAL_SERVER_ERROR,
        error: error.message,
      };
    }
  }
  
  

  async getTotalEventSpraayAmountAndCount(dateRange: TransactionDateRangeDto): Promise<{
    totalAmount: number;
    totalCount: number;
    totalCountCurrentDay: number;
  }> {
    const { startDate, endDate } = dateRange;

    // Calculate total amount and total count within the date range
    const totalData = await this.getRepo()
      .createQueryBuilder('eventSpraay')
      .select('SUM(eventSpraay.amount) AS totalAmount')
      .addSelect('COUNT(eventSpraay.id) AS totalCount')
      .where('eventSpraay.dateCreated BETWEEN :startDate AND :endDate', { startDate, endDate })
      .getRawOne();

    // Calculate total count for the current day
    const currentDate = new Date();
    const currentDateStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
    const currentDateEnd = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 1);

    const totalCountCurrentDay = await this.getRepo()
      .createQueryBuilder('eventSpraay')
      .where('eventSpraay.dateCreated BETWEEN :startDate AND :endDate', {
        startDate: currentDateStart,
        endDate: currentDateEnd,
      })
      .getCount();

    return {
      totalAmount: totalData.totalAmount || 0,
      totalCount: totalData.totalCount || 0,
      totalCountCurrentDay,
    };
  }

}
