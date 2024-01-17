import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  forwardRef
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AxiosError } from 'axios';
import { Not } from 'typeorm';
import {
  UserAccount,
  Withdrawal
} from '@entities/index';
import { GenericService } from '@schematics/index';
import {
  PaymentStatus,
  TransactionType,
  calculateAppCut,
  checkForRequiredFields,
  formatAmount,
  generateUniqueCode,
  httpGet,
  httpPost,
  validateUUIDField,
} from '@utils/index';
import { TransactionService } from '@modules/transaction/transaction.service';
import {
  WithdrawalResponseDTO,
  CreateWithdrawalDTO,
} from './dto/withdrawal.dto';
import {
  UserAccountService,
  UserService,
  WalletService
} from '../index';

@Injectable()
export class WithdrawalService extends GenericService(Withdrawal) {
  private percentageAppFee = Number(process.env.APP_TRANSACTION_FEE) ?? 0;

  constructor(
    @Inject(forwardRef(() => UserAccountService))
    private readonly userAccountSrv: UserAccountService,
    private readonly transactionSrv: TransactionService,
    @Inject(forwardRef(() => WalletService))
    private readonly walletSrv: WalletService,
    private readonly eventEmitterSrv: EventEmitter2,
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
      payload.amount = Number(payload.amount);
      await this.userSrv.checkAccountBalance(payload.amount, userId);

      // Verify account existence
      const destinationAccount =
        await this.walletSrv.verifyExternalAccountNumber(
          payload.bankCode,
          payload.accountNumber,
        );
      this.logger.log({ destinationAccount });
      await this.userSrv.verifyTransactionPin(userId, payload.transactionPin);

      let bank = await this.userAccountSrv.findOne({
        bankCode: payload.bankCode,
        bankName: payload.bankName,
        accountNumber: payload.accountNumber,
        userId,
      });
      if (!bank?.id) {
        bank = await this.userAccountSrv.create<Partial<UserAccount>>({
          bankCode: payload.bankCode,
          bankName: payload.bankName,
          accountName: destinationAccount.accountName,
          accountNumber: payload.accountNumber,
          userId,
        });
      }
      const user = await this.userSrv.findUserById(userId);

      const amountSettled = calculateAppCut(this.percentageAppFee, payload.amount);
      const appCut = Number(payload.amount) - amountSettled;

      const headers = {
        Authorization: `Bearer ${String(process.env.FLUTTERWAVE_SECRET_KEY)}`,
      };
      const reference = `Spraay-payout-${generateUniqueCode(10)}`;
      const narration = `Wallet payout of ₦${formatAmount(payload.amount)} to ${user.data.firstName} ${user.data.lastName}`;
      const url = 'https://api.flutterwave.com/v3/transfers';
      const requestPayload = {
        narration,
        reference,
        currency: 'NGN',
        debit_currency: 'NGN',
        amount: amountSettled,
        account_number: payload.accountNumber,
        account_bank: payload.bankCode,
        // callback_url: 'https://spraay-api-577f3dc0a0fe.herokuapp.com/wallet/webhook',
      };
      const flutterwaveResponse = await httpPost<any, any>(
        url,
        requestPayload,
        headers,
      );
      this.logger.debug({ wtFlutterwaveResponse: flutterwaveResponse });
      if (flutterwaveResponse?.status === 'success') {
        const createdWithdrawal = await this.create<Partial<Withdrawal>>({
          userId,
          reference,
          amount: payload.amount,
          userAccountId: bank.id,
          transferId: Number(flutterwaveResponse.data.id),
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
      if (ex instanceof AxiosError) {
        const errorObject = ex.response?.data;
        this.logger.error(errorObject.message);
        throw new HttpException(errorObject.message, ex.response.status);
      } else {
        this.logger.error(ex);
        throw ex;
      }
    }
  }

  async confirmWithdrawals(): Promise<void> {
    try {
      const headers = {
        Authorization: `Bearer ${String(process.env.FLUTTERWAVE_SECRET_KEY)}`,
      };
      const withdrawals = await this.getRepo().find({ 
        where: { paymentStatus: PaymentStatus.PENDING, transferId: Not(0) },
        take: 5,
      });
      this.logger.debug({ withdrawals });
      if (withdrawals?.length > 0) {
        for (const withdrawal of withdrawals) {
          const transferId = withdrawal.transferId;
          const url = `https://api.flutterwave.com/v3/transfers/${transferId}`;
          const response = await httpGet<any>(url, headers);
          if (response?.data.status === 'SUCCESSFUL') {
            await this.getRepo().update(
              { id: withdrawal.id },
              { paymentStatus: PaymentStatus.SUCCESSFUL }
            );
            const currentBalanceBeforeTransaction = await this.userSrv.getCurrentWalletBalance(withdrawal.userId);
            const transactionRecord = await this.transactionSrv.findOne({ reference: withdrawal.reference });
            const data = response.data;
            if (!transactionRecord?.id) {
              const newTransaction = await this.transactionSrv.createTransaction({
                userId: withdrawal.userId,
                narration: data.narration,
                type: TransactionType.DEBIT,
                amount: parseFloat(data.amount),
                reference: String(data.reference),
                currentBalanceBeforeTransaction,
                transactionDate: data.created_at
              });
              const amountSettled = calculateAppCut(this.percentageAppFee, withdrawal.amount);
              const appCut = Number(withdrawal.amount) - amountSettled;
              // Log amount app earns from the transaction
              this.eventEmitterSrv.emit('app-profit.log', {
                amount: appCut,
                transactionId: newTransaction.data.id,
              });
            }
          }
        }
      }
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }
}
