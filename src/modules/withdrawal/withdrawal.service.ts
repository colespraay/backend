import {
  ConflictException,
  HttpStatus,
  Inject,
  Injectable,
  forwardRef,
} from '@nestjs/common';
import { Transaction, UserAccount, Withdrawal } from '@entities/index';
import { GenericService } from '@schematics/index';
import {
  TransactionType,
  checkForRequiredFields,
  validateUUIDField,
} from '@utils/index';
import { UserAccountService, UserService, WalletService } from '../index';
import {
  WithdrawalResponseDTO,
  CreateWithdrawalDTO,
} from './dto/withdrawal.dto';
import { TransactionService } from '@modules/transaction/transaction.service';

@Injectable()
export class WithdrawalService extends GenericService(Withdrawal) {
  constructor(
    @Inject(forwardRef(() => UserAccountService))
    private readonly userAccountSrv: UserAccountService,
    private readonly transactionSrv: TransactionService,
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

      const currentBalance = await this.userSrv.getCurrentWalletBalance(userId);
      if (payload.amount > currentBalance) {
        throw new ConflictException('Insufficient balance');
      }
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
          Partial<Transaction>
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
        const newWithdrawal = await this.create<Partial<Withdrawal>>({
          amount: payload.amount,
          transactionId: createdTransaction.id,
          userId,
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
