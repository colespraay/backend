import {
  BadGatewayException,
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  forwardRef,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AxiosError } from 'axios';
import { UserAccount, Withdrawal } from '@entities/index';
import { GenericService } from '@schematics/index';
import {
  PaymentStatus,
  TransactionType,
  calculateAppCut,
  checkForRequiredFields,
  formatAmount,
  generatePagaHash,
  generateUniqueCode,
  httpPost,
  validateUUIDField,
} from '@utils/index';
import { TransactionService } from '@modules/transaction/transaction.service';
import {
  WithdrawalResponseDTO,
  CreateWithdrawalDTO,
} from './dto/withdrawal.dto';
import { UserAccountService, UserService, WalletService } from '../index';

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
      const mainAccountBalance = await this.walletSrv.getAccountBalance();
      if (mainAccountBalance.availableBalance <= payload.amount) {
        throw new ConflictException('Insufficient balance in main account');
      }
      const balance = await this.userSrv.checkAccountBalance(
        payload.amount,
        userId,
      );
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

      // Calculate app cut
      const amountSettled = calculateAppCut(
        this.percentageAppFee,
        payload.amount,
      );
      const appCut = Number(payload.amount) - amountSettled;

      const hashKeys = [
        'amount',
        'referenceNumber',
        'destinationBankUUID',
        'destinationBankAccountNumber',
      ];
      const url = `${process.env.PAGA_BASE_URL}/depositToBank`;
      const referenceNumber = generateUniqueCode(13);
      const narration = `Wallet payout of ₦${formatAmount(payload.amount)} to ${
        user.data.firstName
      } ${user.data.lastName}`;
      const requestBody = {
        referenceNumber,
        amount: String(payload.amount),
        currency: 'NGN',
        destinationBankUUID: bank.bankCode,
        destinationBankAccountNumber: bank.accountNumber,
        recipientPhoneNumber: user.data.formattedPhoneNumber,
        remarks: narration,
      };
      const { hash, username, password } = generatePagaHash(
        hashKeys,
        requestBody,
      );
      const headers = {
        hash,
        principal: username,
        credentials: password,
        'Content-Type': 'application/json',
      };
      const response = await httpPost<any, any>(url, requestBody, headers);
      if (!response?.destinationAccountHolderNameAtBank) {
        throw new BadGatewayException('Withdrawal failed');
      }
      const today = new Date();
      const newTransaction = await this.transactionSrv.createTransaction({
        userId,
        amount: payload.amount,
        reference: referenceNumber,
        narration,
        type: TransactionType.DEBIT,
        transactionStatus: PaymentStatus.SUCCESSFUL,
        transactionDate: today.toLocaleString(),
        currentBalanceBeforeTransaction: balance.currentBalance,
      });
      const createdWithdrawal = await this.create<Partial<Withdrawal>>({
        userId,
        amount: payload.amount,
        paymentStatus: PaymentStatus.SUCCESSFUL,
        userAccountId: bank.id,
        reference: referenceNumber,
        transactionId: newTransaction.data.id,
        transferId: response.transactionId,
      });
      return {
        success: true,
        code: HttpStatus.CREATED,
        message: response.message,
        data: createdWithdrawal,
      };
    } catch (ex) {
      if (ex instanceof AxiosError) {
        const errorObject = ex.response.data;
        const message =
          typeof errorObject === 'string' ? errorObject : errorObject.error;
        this.logger.error(message);
        throw new HttpException(message, ex.response.status);
      } else {
        this.logger.error(ex);
        throw ex;
      }
    }
  }

  // async makeWithdrawal2(
  //   payload: CreateWithdrawalDTO,
  //   userId: string,
  // ): Promise<WithdrawalResponseDTO> {
  //   try {
  //     checkForRequiredFields(
  //       [
  //         'userId',
  //         'bankCode',
  //         'bankName',
  //         'amount',
  //         'transactionPin',
  //         'accountNumber',
  //       ],
  //       { ...payload, userId },
  //     );
  //     validateUUIDField(userId, 'userId');
  //     payload.amount = Number(payload.amount);
  //     await this.userSrv.checkAccountBalance(payload.amount, userId);

  //     // Verify account existence
  //     const destinationAccount =
  //       await this.walletSrv.verifyExternalAccountNumber(
  //         payload.bankCode,
  //         payload.accountNumber,
  //       );
  //     this.logger.log({ destinationAccount });
  //     await this.userSrv.verifyTransactionPin(userId, payload.transactionPin);

  //     let bank = await this.userAccountSrv.findOne({
  //       bankCode: payload.bankCode,
  //       bankName: payload.bankName,
  //       accountNumber: payload.accountNumber,
  //       userId,
  //     });
  //     if (!bank?.id) {
  //       bank = await this.userAccountSrv.create<Partial<UserAccount>>({
  //         bankCode: payload.bankCode,
  //         bankName: payload.bankName,
  //         accountName: destinationAccount.accountName,
  //         accountNumber: payload.accountNumber,
  //         userId,
  //       });
  //     }
  //     const user = await this.userSrv.findUserById(userId);

  //     const amountSettled = calculateAppCut(
  //       this.percentageAppFee,
  //       payload.amount,
  //     );
  //     const appCut = Number(payload.amount) - amountSettled;

  //     const headers = {
  //       Authorization: `Bearer ${String(process.env.FLUTTERWAVE_SECRET_KEY)}`,
  //     };
  //     const reference = `Spraay-payout-${generateUniqueCode(10)}`;
  //     const narration = `Wallet payout of ₦${formatAmount(payload.amount)} to ${
  //       user.data.firstName
  //     } ${user.data.lastName}`;
  //     const url = 'https://api.flutterwave.com/v3/transfers';
  //     const requestPayload = {
  //       narration,
  //       reference,
  //       currency: 'NGN',
  //       debit_currency: 'NGN',
  //       amount: amountSettled,
  //       account_number: payload.accountNumber,
  //       account_bank: payload.bankCode,
  //       // callback_url: 'https://spraay-api-577f3dc0a0fe.herokuapp.com/wallet/webhook',
  //     };
  //     const flutterwaveResponse = await httpPost<any, any>(
  //       url,
  //       requestPayload,
  //       headers,
  //     );
  //     this.logger.debug({ wtFlutterwaveResponse: flutterwaveResponse });
  //     if (flutterwaveResponse?.status === 'success') {
  //       const createdWithdrawal = await this.create<Partial<Withdrawal>>({
  //         userId,
  //         reference,
  //         amount: payload.amount,
  //         userAccountId: bank.id,
  //         transferId: Number(flutterwaveResponse.data.id),
  //       });
  //       const newWithdrawal = await this.getRepo().findOne({
  //         where: { id: createdWithdrawal.id },
  //         relations: ['transaction'],
  //       });
  //       return {
  //         success: true,
  //         code: HttpStatus.CREATED,
  //         data: newWithdrawal,
  //         message: 'Withdrawal successful',
  //       };
  //     }
  //     throw new BadGatewayException('Withdrawal failed');
  //   } catch (ex) {
  //     if (ex instanceof AxiosError) {
  //       const errorObject = ex.response?.data;
  //       this.logger.error(errorObject.message);
  //       throw new HttpException(errorObject.message, ex.response.status);
  //     } else {
  //       this.logger.error(ex);
  //       throw ex;
  //     }
  //   }
  // }
}
