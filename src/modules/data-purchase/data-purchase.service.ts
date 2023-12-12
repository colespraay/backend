import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BillService } from '@modules/bill/bill.service';
import { DataPurchase, User } from '@entities/index';
import { TransactionService } from '@modules/transaction/transaction.service';
import {
  AirtimeProvider,
  TransactionType,
  UserNotificationType,
  checkForRequiredFields,
  compareEnumValueFields,
  formatPhoneNumberWithPrefix,
} from '@utils/index';
import { GenericService } from '@schematics/index';
import { WalletService } from '@modules/wallet/wallet.service';
import { BankService } from '@modules/bank/bank.service';
import {
  CreateDataPurchaseDTO,
  DataPurchaseResponseDTO,
} from './dto/data-purchase.dto';
import { UserService } from '../index';

@Injectable()
export class DataPurchaseService extends GenericService(DataPurchase) {
  private flutterwaveBaseBank = String(process.env.FLUTTERWAVE_BASE_BANK);
  private flutterwaveBaseAccountName = String(
    process.env.FLUTTERWAVE_BASE_ACCOUNT_NAME,
  );
  private flutterwaveBaseAccountNumber = String(
    process.env.FLUTTERWAVE_BASE_ACCOUNT_NUMBER,
  );

  constructor(
    private readonly userSrv: UserService,
    private readonly billSrv: BillService,
    private readonly transactionSrv: TransactionService,
    private readonly walletSrv: WalletService,
    private readonly bankSrv: BankService,
    private readonly eventEmitterSrv: EventEmitter2,
  ) {
    super();
  }

  async createDataPurchase(
    payload: CreateDataPurchaseDTO,
    user: User,
  ): Promise<DataPurchaseResponseDTO> {
    try {
      checkForRequiredFields(
        ['provider', 'transactionPin', 'phoneNumber', 'dataPlanId'],
        {
          ...payload,
          userId: user.id,
        },
      );
      compareEnumValueFields(
        payload.provider,
        Object.values(AirtimeProvider),
        'provider',
      );
      payload.phoneNumber = formatPhoneNumberWithPrefix(payload.phoneNumber);
      const isPinValid = await this.userSrv.verifyTransactionPin(
        user.id,
        payload.transactionPin,
      );
      if (!isPinValid?.success) {
        throw new BadRequestException('Invalid transaction pin');
      }
      const plan = await this.billSrv.findDataPlanById(payload.dataPlanId);
      await this.userSrv.checkAccountBalance(plan.amount, user.id);

      const walletVerified = await this.walletSrv.verifyWalletAccountNumber(
        user.virtualAccountNumber,
      );
      this.logger.log({ walletVerified });
      const bank = await this.bankSrv.findOne({
        bankName: this.flutterwaveBaseBank?.toUpperCase(),
      });
      if (!bank?.id) {
        throw new ConflictException('Could not validate base account');
      }

      // Make purchase from flutterwave
      const narration = `Data purchase (₦${plan.amount}) for ${payload.phoneNumber}`;
      const walletResponse = await this.walletSrv.makeTransferFromWallet(
        user.virtualAccountNumber,
        {
          narration,
          amount: plan.amount,
          destinationBankCode: bank.bankCode,
          destinationBankName: this.flutterwaveBaseBank,
          destinationAccountName: this.flutterwaveBaseAccountName,
          destinationAccountNumber: this.flutterwaveBaseAccountNumber,
        },
      );
      if (!walletResponse.success) {
        throw new BadGatewayException('Wallet withdrawal failed');
      }
      // const transactionDate = new Date().toLocaleString();
      // const reference = `Spraay-data-${generateUniqueCode(10)}`;
      const transactionDate = String(
        walletResponse.data.orinalTxnTransactionDate,
      );
      const reference = String(walletResponse.data.transactionReference);
      const dataPurchaseResponse = await this.billSrv.makeDataPurchase(
        {
          amount: plan.amount,
          phoneNumber: payload.phoneNumber,
          provider: payload.provider,
          transactionPin: payload.transactionPin,
          type: plan.biller_name,
        },
        reference,
      );
      this.logger.log({ dataPurchaseResponse });
      const newTransaction = await this.transactionSrv.createTransaction({
        narration,
        userId: user.id,
        amount: plan.amount,
        type: TransactionType.DEBIT,
        reference,
        transactionDate,
        currentBalanceBeforeTransaction: user.walletBalance,
      });
      const createdDataPurchase = await this.create<Partial<DataPurchase>>({
        ...payload,
        transactionId: newTransaction.data.id,
        amount: plan.amount,
        userId: user.id,
      });
      this.eventEmitterSrv.emit('user-notification.create', {
        userId: user.id,
        subject: 'Data Purchase',
        type: UserNotificationType.USER_SPECIFIC,
        message: `Your data purchase of ₦${plan.amount} was successful`,
      });
      return {
        success: true,
        code: HttpStatus.CREATED,
        data: createdDataPurchase,
        message: dataPurchaseResponse.message,
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }
}
