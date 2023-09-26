import {
  BadGatewayException,
  ConflictException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Gifting, Transaction } from '@entities/index';
import { GenericService } from '@schematics/index';
import {
  TransactionType,
  checkForRequiredFields,
  validateUUIDField,
  verifyPasswordHash,
} from '@utils/index';
import { UserService, WalletService } from '../index';
import { GiftingResponseDTO, SendGiftDTO } from './dto/gifting.dto';
import { TransactionService } from '@modules/transaction/transaction.service';

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
      if (payload.amount > user.data.walletBalance) {
        throw new ConflictException('Insufficient balance');
      }
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

      // TODO: Uncomment for controlled test
      // const walletVerified = await this.walletSrv.verifyWalletAccountNumber(
      //   receiver.virtualAccountNumber,
      // );
      // this.logger.log({ walletVerified });

      // make transfer via wema bank
      const debitResponse = await this.walletSrv.makeTransferFromWallet(
        user.data.virtualAccountNumber,
        {
          amount: payload.amount,
          destinationAccountName: receiver.virtualAccountName,
          destinationAccountNumber: receiver.virtualAccountNumber,
          destinationBankCode: destinationBank.bankCode,
          destinationBankName: destinationBank.bankName,
          narration: `Gift of ${payload.amount.toLocaleString()} sent to ${
            receiver.firstName
          } ${receiver.lastName}`,
        },
      );
      if (debitResponse.success) {
        const createdTransaction = await this.transactionSrv.create<
          Partial<Transaction>
        >({
          transactionDate: debitResponse.data.orinalTxnTransactionDate,
          currentBalanceBeforeTransaction: user.data.walletBalance,
          narration: debitResponse.data.narration,
          type: TransactionType.DEBIT,
          reference: debitResponse.data.transactionReference,
          receiverUserId: receiver.id,
          amount: payload.amount,
          userId,
        });
        this.logger.log({ createdTransaction });
        const createdGift = await this.create<Partial<Gifting>>({
          amount: payload.amount,
          receiverUserId: receiver.id,
          transactionId: createdTransaction.id,
        });
        const newAccountBalance = user.data.walletBalance - payload.amount;
        await this.userSrv
          .getRepo()
          .update({ id: user.data.id }, { walletBalance: newAccountBalance });
        // Credit account of event owner
        this.eventEmitterSrv.emit('wallet.credit', {
          userId: receiver.id,
          amount: payload.amount,
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
