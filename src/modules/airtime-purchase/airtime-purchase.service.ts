import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AirtimeProvider,
  TransactionType,
  UserNotificationType,
  checkForRequiredFields,
  compareEnumValueFields,
  formatPhoneNumberWithPrefix,
} from '@utils/index';
import { BankService } from '@modules/bank/bank.service';
import { WalletService } from '@modules/wallet/wallet.service';
import { TransactionService } from '@modules/transaction/transaction.service';
import { AirtimePurchase, User } from '@entities/index';
import { GenericService } from '@schematics/index';
import { UserService } from '@modules/user/user.service';
import { BillService } from '@modules/bill/bill.service';
import {
  CreateAirtimePurchaseDTO,
  AirtimePurchaseResponseDTO,
} from './dto/airtime-purchase.dto';

@Injectable()
export class AirtimePurchaseService extends GenericService(AirtimePurchase) {
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
    private readonly bankSrv: BankService,
    private readonly walletSrv: WalletService,
    private readonly transactionSrv: TransactionService,
    private readonly eventEmitterSrv: EventEmitter2,
  ) {
    super();
  }

  async createAirtimePurchase(
    payload: CreateAirtimePurchaseDTO,
    user: User,
  ): Promise<AirtimePurchaseResponseDTO> {
    try {
      checkForRequiredFields(
        ['userId', 'provider', 'amount', 'phoneNumber', 'transactionPin'],
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
      await this.userSrv.checkAccountBalance(payload.amount, user.id);
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
      const narration = `Airtime purchase (₦${payload.amount}) for ${payload.phoneNumber}`;
      const walletResponse = await this.walletSrv.makeTransferFromWallet(
        user.virtualAccountNumber,
        {
          narration,
          amount: payload.amount,
          destinationBankCode: bank.bankCode,
          destinationBankName: this.flutterwaveBaseBank,
          destinationAccountName: this.flutterwaveBaseAccountName,
          destinationAccountNumber: this.flutterwaveBaseAccountNumber,
        },
      );
      if (!walletResponse.success) {
        throw new BadGatewayException('Wallet withdrawal failed');
      }

      const reference = String(walletResponse.data.transactionReference);
      const transactionDate = String(
        walletResponse.data.orinalTxnTransactionDate,
      );
      // const transactionDate = new Date().toLocaleString();
      // const reference = `Spraay-airtime-${generateUniqueCode(10)}`;

      // Make purchase from flutterwave
      const airtimePurchaseResponse = await this.billSrv.makeAirtimePurchase(
        payload,
        reference,
      );
      this.logger.log({ airtimePurchaseResponse });
      const newTransaction = await this.transactionSrv.createTransaction({
        narration,
        userId: user.id,
        amount: payload.amount,
        type: TransactionType.DEBIT,
        reference,
        transactionDate,
        currentBalanceBeforeTransaction: user.walletBalance,
      });
      const createdAirtimePurchase = await this.create<
        Partial<AirtimePurchase>
      >({
        ...payload,
        transactionId: newTransaction.data.id,
        userId: user.id,
      });
      this.eventEmitterSrv.emit('user-notification.create', {
        userId: user.id,
        subject: 'Airtime Purchase',
        type: UserNotificationType.USER_SPECIFIC,
        message: `Your airtime purchase of ₦${payload.amount} was successful`,
      });
      return {
        success: true,
        code: HttpStatus.CREATED,
        data: createdAirtimePurchase,
        message: airtimePurchaseResponse.message,
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }
}
