import { ConflictException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AxiosError } from 'axios';
import {
  TransactionType,
  checkForRequiredFields,
  formatPhoneNumberWithPrefix,
  generateUniqueCode,
} from '@utils/index';
import { TransactionService } from '@modules/transaction/transaction.service';
import { AirtimePurchase, User } from '@entities/index';
import { GenericService } from '@schematics/index';
import { UserService } from '@modules/user/user.service';
import { BillService } from '@modules/bill/bill.service';
import { WalletService } from '@modules/wallet/wallet.service';
import {
  CreateAirtimePurchaseDTO,
  AirtimePurchaseResponseDTO,
} from './dto/airtime-purchase.dto';

@Injectable()
export class AirtimePurchaseService extends GenericService(AirtimePurchase) {
  constructor(
    private readonly userSrv: UserService,
    private readonly billSrv: BillService,
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
        ['userId', 'providerId', 'amount', 'phoneNumber', 'transactionPin'],
        {
          ...payload,
          userId: user.id,
        },
      );
      payload.phoneNumber = formatPhoneNumberWithPrefix(payload.phoneNumber);
      await this.userSrv.verifyTransactionPin(
        user.id,
        payload.transactionPin,
      );
      await this.userSrv.checkAccountBalance(payload.amount, user.id);
      const { availableBalance } = await this.walletSrv.getAccountBalance();
      if (availableBalance < payload.amount) {
        throw new ConflictException('Insufficient balance');
      }
      const narration = `Airtime purchase (₦${payload.amount}) for ${payload.phoneNumber}`;
      const transactionDate = new Date().toLocaleString();
      const reference = `Spraay-airtime-${generateUniqueCode(10)}`;

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
        reference: airtimePurchaseResponse.data?.reference,
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
      return {
        success: true,
        code: HttpStatus.CREATED,
        data: createdAirtimePurchase,
        message: airtimePurchaseResponse.message,
      };
    } catch (ex) {
      if (ex instanceof AxiosError) {
        const errorObject = ex.response.data;
        const message = typeof errorObject === 'string' ? errorObject : errorObject.message;
        this.logger.error(message);
        throw new HttpException(message, ex.response.status);
      } else {
        this.logger.error(ex);
        throw ex;
      }
    }
  }
}
