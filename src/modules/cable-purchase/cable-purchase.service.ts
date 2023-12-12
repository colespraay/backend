import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { CablePurchase, User } from '@entities/index';
import { GenericService } from '@schematics/index';
import {
  checkForRequiredFields,
  compareEnumValueFields,
  CableProvider,
  TransactionType,
  UserNotificationType,
} from '@utils/index';
import { WalletService } from '@modules/wallet/wallet.service';
import { BankService } from '@modules/bank/bank.service';
import { TransactionService } from '@modules/transaction/transaction.service';
import { BillService } from '@modules/bill/bill.service';
import { UserService } from '@modules/user/user.service';
import {
  CablePurchaseResponseDTO,
  CreateCableProviderDTO,
} from './dto/cable-purchase.dto';

@Injectable()
export class CablePurchaseService extends GenericService(CablePurchase) {
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
    private readonly walletSrv: WalletService,
    private readonly bankSrv: BankService,
    private readonly transactionSrv: TransactionService,
    private readonly eventEmitterSrv: EventEmitter2,
  ) {
    super();
  }

  async createCablePurchase(
    payload: CreateCableProviderDTO,
    user: User,
  ): Promise<CablePurchaseResponseDTO> {
    try {
      checkForRequiredFields(
        [
          'amount',
          'smartCardNumber',
          'transactionPin',
          'provider',
          'cablePlanId',
        ],
        payload,
      );
      compareEnumValueFields(
        payload.provider,
        Object.values(CableProvider),
        'provider',
      );
      const isPinValid = await this.userSrv.verifyTransactionPin(
        user.id,
        payload.transactionPin,
      );
      if (!isPinValid?.success) {
        throw new BadRequestException('Invalid transaction pin');
      }
      const plan = await this.billSrv.findCableProviderById(
        payload.cablePlanId,
      );
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

      // Make purchase from flutterwave
      const narration = `Cable plan purchase (₦${plan.amount}) for ${payload.smartCardNumber}`;
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
      // const reference = `Spraay-cable-${generateUniqueCode(10)}`;
      const transactionDate = String(
        walletResponse.data.orinalTxnTransactionDate,
      );
      const reference = String(walletResponse.data.transactionReference);
      const cablePurchaseResponse = await this.billSrv.makeCablePlanPurchase(
        {
          amount: plan.amount,
          smartCardNumber: payload.smartCardNumber,
          provider: payload.provider,
          transactionPin: payload.transactionPin,
        },
        reference,
        plan,
      );
      this.logger.log({ cablePurchaseResponse });
      const newTransaction = await this.transactionSrv.createTransaction({
        narration,
        userId: user.id,
        amount: plan.amount,
        type: TransactionType.DEBIT,
        reference,
        transactionDate,
        currentBalanceBeforeTransaction: user.walletBalance,
      });
      const createdCablePlanPurchase = await this.create<
        Partial<CablePurchase>
      >({
        amount: plan.amount,
        userId: user.id,
        provider: payload.provider,
        smartCardNumber: payload.smartCardNumber,
        cablePlanId: plan.id,
        transactionId: newTransaction.data.id,
      });
      this.eventEmitterSrv.emit('user-notification.create', {
        userId: user.id,
        subject: 'Cable TV Purchase',
        type: UserNotificationType.USER_SPECIFIC,
        message: `Your cable-tv purchase of ₦${plan.amount} was successful`,
      });
      return {
        success: true,
        code: HttpStatus.CREATED,
        data: createdCablePlanPurchase,
        message: cablePurchaseResponse.message,
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }
}
