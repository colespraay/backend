import {
  ConflictException,
  HttpStatus,
  Inject,
  Injectable,
  forwardRef,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TransactionService } from '@modules/transaction/transaction.service';
import { TransactionRecord, UserAccount, Withdrawal } from '@entities/index';
import { GenericService } from '@schematics/index';
import {
  TransactionType,
  checkForRequiredFields,
  generateUniqueCode,
  httpGet,
  httpPost,
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

      const headers = {
        Authorization: `Bearer ${String(process.env.FLUTTERWAVE_SECRET_KEY)}`,
      };
      // transfer from wallet
      const reference = `Spraay-payout-${generateUniqueCode(10)}`;
      const narration = `Wallet payout of ₦${payload.amount} to ${user.data.firstName} ${user.data.lastName}`;
      const url = 'https://api.flutterwave.com/v3/transfers';
      const reqPayload = {
        reference,
        account_number: payload.accountNumber,
        account_bank: payload.bankCode,
        currency: 'NGN',
        narration,
        amount: payload.amount,
      };
      const flutterwaveResponse = await httpPost<any, any>(
        url,
        reqPayload,
        headers,
      );
      if (flutterwaveResponse?.status === 'success') {
        const data = flutterwaveResponse.data;
        const reference = `Spraay-payout-${generateUniqueCode(10)}`;
        const narration = `Wallet payout of ₦${payload.amount} to ${user.data.firstName} ${user.data.lastName}`;
        // Log the debit to transaction table
        const createdTransaction = await this.transactionSrv.create<
          Partial<TransactionRecord>
        >({
          transactionDate: data.created_at,
          currentBalanceBeforeTransaction: user.data.walletBalance,
          narration,
          type: TransactionType.DEBIT,
          reference,
          amount: payload.amount,
          userId,
        });
        this.logger.log({ createdTransaction });

        // Update user's account balance, after checking to see transaction went through
        setTimeout(async () => {
          const fetchTransferUrl = `https://api.flutterwave.com/v3/transfers/${data.id}`;
          const resp = await httpGet<any>(fetchTransferUrl, headers);
          if (resp?.data.status === 'SUCCESSFUL') {
            this.eventEmitterSrv.emit('wallet.debit', {
              amount: payload.amount,
              userId: user.data.id,
            });
          }
        }, 5000);

        const createdWithdrawal = await this.create<Partial<Withdrawal>>({
          amount: payload.amount,
          transactionId: createdTransaction.id,
          userId,
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
