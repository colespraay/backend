import { BadRequestException, HttpStatus, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AirtimeProvider,
  TransactionType,
  checkForRequiredFields,
  compareEnumValueFields,
  formatPhoneNumberWithPrefix,
  generateUniqueCode,
} from '@utils/index';
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
  constructor(
    private readonly userSrv: UserService,
    private readonly billSrv: BillService,
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
