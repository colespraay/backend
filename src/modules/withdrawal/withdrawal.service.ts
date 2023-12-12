import { HttpStatus, Inject, Injectable, forwardRef } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TransactionService } from '@modules/transaction/transaction.service';
import { TransactionRecord, UserAccount, Withdrawal } from '@entities/index';
import { GenericService } from '@schematics/index';
import {
  TransactionType,
  UserNotificationType,
  checkForRequiredFields,
  validateUUIDField,
} from '@utils/index';
import { UserAccountService, UserService, WalletService } from '../index';
import {
  WithdrawalResponseDTO,
  CreateWithdrawalDTO,
} from './dto/withdrawal.dto';

@Injectable()
export class WithdrawalService extends GenericService(Withdrawal) {
  constructor(
    @Inject(forwardRef(() => UserAccountService))
    private readonly userAccountSrv: UserAccountService,
    private readonly transactionSrv: TransactionService,
    private readonly eventEmitterSrv: EventEmitter2,
    private readonly walletSrv: WalletService,
    private readonly userSrv: UserService,
  ) {
    super();
  }

  async makeWithdrawal(
    payload: CreateWithdrawalDTO,
    userId: string,
  ): Promise<WithdrawalResponseDTO> {
    try {
      checkForRequiredFields(
        [
          'userId',
          'bankCode',
          'bankName',
          'amount',
          'transactionPin',
          'accountNumber',
        ],
        { ...payload, userId },
      );
      validateUUIDField(userId, 'userId');
      await this.userSrv.checkAccountBalance(payload.amount, userId);

      // Verify account existence
      const destinationAccount =
        await this.walletSrv.verifyExternalAccountNumber(
          payload.bankCode,
          payload.accountNumber,
        );
      this.logger.log({ destinationAccount });
      await this.userSrv.verifyTransactionPin(userId, payload.transactionPin);

      const bank = await this.userAccountSrv.findOne({
        bankCode: payload.bankCode,
        bankName: payload.bankName,
        accountNumber: payload.accountNumber,
        userId,
      });
      if (!bank?.id) {
        await this.userAccountSrv.create<Partial<UserAccount>>({
          bankCode: payload.bankCode,
          bankName: payload.bankName,
          accountName: destinationAccount.accountName,
          accountNumber: payload.accountNumber,
          userId,
        });
      }
      const user = await this.userSrv.findUserById(userId);

      // make transfer via wema bank
      const debitResponse = await this.walletSrv.makeTransferFromWallet(
        user.data.virtualAccountNumber,
        {
          amount: payload.amount,
          destinationAccountName: destinationAccount.accountName,
          destinationAccountNumber: payload.accountNumber,
          destinationBankCode: payload.bankCode,
          destinationBankName: payload.bankName,
          narration: `Withdrawal of ${payload.amount.toLocaleString()} sent to ${
            payload.accountNumber
          } of ${payload.bankName}`,
        },
      );
      if (debitResponse.success) {
        const createdTransaction = await this.transactionSrv.create<
          Partial<TransactionRecord>
        >({
          transactionDate: debitResponse.data.orinalTxnTransactionDate,
          currentBalanceBeforeTransaction: user.data.walletBalance,
          narration: debitResponse.data.narration,
          type: TransactionType.DEBIT,
          reference: debitResponse.data.transactionReference,
          amount: payload.amount,
          userId,
        });
        this.logger.log({ createdTransaction });
        const createdWithdrawal = await this.create<Partial<Withdrawal>>({
          amount: payload.amount,
          transactionId: createdTransaction.id,
          userId,
        });
        this.eventEmitterSrv.emit('wallet.debit', {
          amount: payload.amount,
          userId: user.data.id,
        });
        this.eventEmitterSrv.emit('user-notification.create', {
          userId,
          subject: 'Cash withdrawal from wallet',
          type: UserNotificationType.USER_SPECIFIC,
          message: `You withdrew ₦${payload.amount} from your wallet`,
        });
        const newWithdrawal = await this.getRepo().findOne({
          where: { id: createdWithdrawal.id },
          relations: ['transaction'],
        });
        return {
          success: true,
          code: HttpStatus.CREATED,
          data: newWithdrawal,
          message: 'Withdrawal successful',
        };
      }
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }
}
