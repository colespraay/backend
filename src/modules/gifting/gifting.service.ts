import {
  ConflictException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Gifting } from '@entities/index';
import { GenericService } from '@schematics/index';
import { TransactionService } from '@modules/transaction/transaction.service';
import {
  TransactionType,
  UserNotificationType,
  checkForRequiredFields,
  generateUniqueCode,
  validateUUIDField,
  verifyPasswordHash,
} from '@utils/index';
import { GiftingResponseDTO, SendGiftDTO } from './dto/gifting.dto';
import { UserService } from '../index';

@Injectable()
export class GiftingService extends GenericService(Gifting) {
  constructor(
    private readonly userSrv: UserService,
    private readonly eventEmitterSrv: EventEmitter2,
    private readonly transactionSrv: TransactionService,
  ) {
    super();
  }

  async sendGift(
    payload: SendGiftDTO,
    userId: string,
  ): Promise<GiftingResponseDTO> {
    try {
      checkForRequiredFields(
        ['amount', 'userId', 'receiverTag', 'transactionPin'],
        { ...payload, userId },
      );
      validateUUIDField(userId, 'userId');
      // Check account balance
      const user = await this.userSrv.findUserById(userId);
      const isPinValid = await verifyPasswordHash(
        payload.transactionPin,
        user.data.transactionPin,
      );
      if (!isPinValid) {
        throw new UnauthorizedException('Invalid/unknown transaction pin');
      }
      await this.userSrv.checkAccountBalance(payload.amount, user.data.id);
      const receiver = await this.userSrv.findOne({
        userTag: payload.receiverTag,
      });
      if (!receiver?.id) {
        throw new NotFoundException(
          `Could not identify receiver with tag: '${payload.receiverTag}'`,
        );
      }
      if (userId === receiver.id) {
        throw new ConflictException('Cannot Gift to yourself');
      }
      const transactionDate = new Date().toLocaleString();
      const reference = `Spraay-gift-${generateUniqueCode(10)}`;
      const narration = `Gift of ₦${payload.amount} to ${receiver.firstName} ${receiver.lastName}`;
      const createdTransaction = await this.transactionSrv.createTransaction({
        amount: payload.amount,
        currentBalanceBeforeTransaction: user.data.walletBalance,
        narration,
        transactionDate,
        type: TransactionType.DEBIT,
        userId,
        receiverUserId: receiver.id,
        reference,
      });
      this.logger.log({ createdTransaction });

      const createdGift = await this.create<Partial<Gifting>>({
        amount: payload.amount,
        receiverUserId: receiver.id,
        transactionId: createdTransaction.data.id,
      });

      const receiverTransaction = await this.transactionSrv.createTransaction({
        amount: payload.amount,
        currentBalanceBeforeTransaction: receiver.walletBalance,
        narration,
        transactionDate,
        type: TransactionType.CREDIT,
        userId: receiver.id,
        reference,
      });
      this.logger.log({ receiverTransaction });

      this.eventEmitterSrv.emit('user-notification.create', {
        userId: receiver.id,
        subject: 'Cash gift received',
        type: UserNotificationType.USER_SPECIFIC,
        message: `You were gifted with ₦${payload.amount} by ${user.data.firstName} ${user.data.lastName}`,
      });
      this.eventEmitterSrv.emit('user-notification.create', {
        userId: user.data.id,
        subject: 'Cash gifting',
        type: UserNotificationType.USER_SPECIFIC,
        message: `You gifted ${receiver?.firstName} ${receiver?.lastName} with ₦${payload.amount}`,
      });
      return {
        success: true,
        code: HttpStatus.CREATED,
        message: 'Gift sent successfully',
        data: createdGift,
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }
}
