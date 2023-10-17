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
  checkForRequiredFields,
  compareEnumValueFields,
  formatPhoneNumberWithPrefix,
} from '@utils/index';
import { AirtimePurchase, User } from '@entities/index';
import { GenericService } from '@schematics/index';
import { UserService } from '@modules/user/user.service';
import { BankService } from '@modules/bank/bank.service';
import { WalletService } from '@modules/wallet/wallet.service';
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
    private readonly bankSrv: BankService,
    private readonly walletSrv: WalletService,
    private readonly billSrv: BillService,
    private readonly eventEmitterSrv: EventEmitter2,
  ) {
    super();
  }

  // F.E should
  // 1. verify pin
  // 2. Verify account balance
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
        throw new BadRequestException('Invalid pin');
      }
      const enoughBalance =
        await this.userSrv.doesUserHaveEnoughBalanceInWallet(
          user.id,
          payload.amount,
        );
      if (!enoughBalance) {
        throw new ConflictException('Insufficient balance');
      }
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
      // Make purchase from flutterwave
      const airtimePurchaseResponse = await this.billSrv.makeAirtimePurchase(
        payload,
      );
      this.logger.log({ airtimePurchaseResponse });
      const createdAirtimePurchase = await this.create<
        Partial<AirtimePurchase>
      >({
        ...payload,
        userId: user.id,
      });
      this.eventEmitterSrv.emit('transaction.log', {
        narration,
        userId: user.id,
        amount: payload.amount,
        type: TransactionType.DEBIT,
        currentBalanceBeforeTransaction: user.walletBalance,
        transactionDate: walletResponse.data.orinalTxnTransactionDate,
      });
      this.eventEmitterSrv.emit('wallet.debit', {
        userId: user.id,
        amount: payload.amount,
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
