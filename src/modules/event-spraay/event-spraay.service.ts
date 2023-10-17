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
  calculatePaginationControls,
  checkForRequiredFields,
  validateUUIDField,
} from '@utils/index';
import { TransactionService } from '@modules/transaction/transaction.service';
import {
  EventSpraayResponseDTO,
  CreateEventSpraayDTO,
  EventSpraayCreatedResponseDTO,
  EventSpraaysResponseDTO,
  FindEventSpraaysDTO,
} from './dto/event-spraay.dto';
import { EventService, UserService, WalletService } from '../index';

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
    try {
      checkForRequiredFields(
        ['userId', 'eventId', 'amount', 'transactionPin'],
        {
          ...payload,
          userId: user.id,
        },
      );
      validateUUIDField(payload.eventId, 'eventId');
      const isPinValid = await this.userSrv.verifyTransactionPin(
        user.id,
        payload.transactionPin,
      );
      if (!isPinValid?.success) {
        throw new BadRequestException('Invalid transaction pin');
      }
      const enoughBalance =
        await this.userSrv.doesUserHaveEnoughBalanceInWallet(
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
      const bank = await this.walletSrv.findBankByName(
        event.data.user.bankName ?? String(process.env.DEFAULT_BANK),
      );
      const currentWalletBalance = await this.userSrv.getCurrentWalletBalance(
        user.id,
      );
      const walletVerified = await this.walletSrv.verifyWalletAccountNumber(
        event.data.user.virtualAccountNumber,
      );
      this.logger.log({ walletVerified });

      const narration = `Spraayed by ${user?.firstName} ${user?.lastName}`;
      const debitTransaction = await this.walletSrv.makeTransferFromWallet(
        user.virtualAccountNumber,
        {
          narration,
          amount: payload.amount,
          destinationBankCode: bank.bankCode,
          destinationBankName: event.data.user.bankName,
          destinationAccountName: event.data.user.virtualAccountName,
          destinationAccountNumber: event.data.user.virtualAccountNumber,
        },
      );
      // Also handles the debit of user's wallet
      const newTransaction = await this.transactionSrv.createTransaction({
        reference: debitTransaction.data.transactionReference,
        transactionDate: debitTransaction.data.orinalTxnTransactionDate,
        currentBalanceBeforeTransaction: currentWalletBalance,
        type: TransactionType.DEBIT,
        userId: user.id,
        amount: payload.amount,
        narration,
      });
      const newSpraay = await this.create<Partial<EventSpraay>>({
        ...payload,
        userId: user.id,
        transactionId: newTransaction.data.id,
      });
      // Credit account of event owner
      this.eventEmitterSrv.emit('wallet.credit', {
        userId: event.data.userId,
        amount: payload.amount,
      });
      // this.eventEmitterSrv.emit('wallet.debit', {
      //   userId: user.id,
      //   amount: payload.amount,
      // });
      return {
        success: true,
        data: newSpraay,
        code: HttpStatus.CREATED,
        eventCode: event.data.eventCode,
        transactionReference: newTransaction.data.reference,
        message: `#${payload.amount.toLocaleString()} Cash spraayed`,
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
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
}
