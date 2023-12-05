import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  BadGatewayException,
  ConflictException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Gifting } from '@entities/index';
import { GenericService } from '@schematics/index';
import { WalletService } from '@modules/wallet/wallet.service';
import { TransactionService } from '@modules/transaction/transaction.service';
import {
  TransactionType,
  UserNotificationType,
  checkForRequiredFields,
  validateUUIDField,
  verifyPasswordHash,
} from '@utils/index';
import { GiftingResponseDTO, SendGiftDTO } from './dto/gifting.dto';
import { UserService } from '../index';

@Injectable()
export class GiftingService extends GenericService(Gifting) {
  constructor(
    private readonly userSrv: UserService,
    private readonly walletSrv: WalletService,
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

      const destinationBank = await this.walletSrv.findBankByName(
        receiver.bankName,
      );
      if (!destinationBank?.bankCode) {
        throw new BadGatewayException('Could not verify destination bank');
      }
      const walletVerified = await this.walletSrv.verifyWalletAccountNumber(
        receiver.virtualAccountNumber,
      );
      this.logger.log({ walletVerified });

      // make transfer via wema bank
      const debitResponse = await this.walletSrv.makeTransferFromWallet(
        user.data.virtualAccountNumber,
        {
          amount: payload.amount,
          destinationAccountName: receiver.virtualAccountName,
          destinationAccountNumber: receiver.virtualAccountNumber,
          destinationBankCode: destinationBank.bankCode,
          destinationBankName: destinationBank.name,
          narration: `Gift of ${payload.amount.toLocaleString()} sent to ${
            receiver.firstName
          } ${receiver.lastName}`,
        },
      );
      if (debitResponse.success) {
        const narration = debitResponse.data.narration;
        const transactionDate = debitResponse.data.orinalTxnTransactionDate;
        const reference = debitResponse.data.transactionReference;
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
        const receiverTransaction = await this.transactionSrv.createTransaction(
          {
            amount: payload.amount,
            currentBalanceBeforeTransaction: receiver.walletBalance,
            narration,
            transactionDate,
            type: TransactionType.CREDIT,
            userId: receiver.id,
            reference,
          },
        );
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
      }
      throw new BadGatewayException('Transaction failed');
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }
}
