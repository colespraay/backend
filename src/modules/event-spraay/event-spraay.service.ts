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
import { FindManyOptions } from 'typeorm';
import { EventSpraay, User } from '@entities/index';
import { GenericService } from '@schematics/index';
import {
  TransactionType,
  UserNotificationType,
  calculatePaginationControls,
  checkForRequiredFields,
  generateUniqueCode,
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
    const isPinValid = await this.userSrv.verifyTransactionPin(
      user.id,
      payload.transactionPin,
    );
    if (!isPinValid?.success) {
      throw new BadRequestException('Invalid transaction pin');
    }
    const enoughBalance = await this.userSrv.doesUserHaveEnoughBalanceInWallet(
      user.id,
      payload.amount,
    );
    if (!enoughBalance) {
      throw new ConflictException('Insufficient balance');
    }
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
    const recipientNarration = `₦${payload.amount} was 'spraayed' on you by ${user.firstName} ${user.lastName}`;
    const creditTransaction = await this.transactionSrv.createTransaction({
      reference,
      transactionDate,
      currentBalanceBeforeTransaction: recipientCurrentBalance,
      amount: payload.amount,
      narration: recipientNarration,
      type: TransactionType.CREDIT,
      userId: event.data.userId,
    });
    this.logger.debug({ creditTransaction });

    this.eventEmitterSrv.emit('user-notification.create', {
      userId: event.data.userId,
      subject: 'Cash sprayed',
      type: UserNotificationType.USER_SPECIFIC,
      message: `You were sprayed with ₦${payload.amount} by ${user.firstName} ${user.lastName}`,
    });

    this.eventEmitterSrv.emit('user-notification.create', {
      userId: user.id,
      subject: 'Cash sprayed',
      type: UserNotificationType.USER_SPECIFIC,
      message: `You sprayed ₦${payload.amount} on ${event.data?.user?.firstName} ${event.data?.user?.lastName}`,
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
}
