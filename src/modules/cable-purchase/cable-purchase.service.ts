import { BadRequestException, HttpStatus, Injectable } from '@nestjs/common';
import { CablePurchase, User } from '@entities/index';
import { GenericService } from '@schematics/index';
import {
  checkForRequiredFields,
  compareEnumValueFields,
  CableProvider,
  TransactionType,
  generateUniqueCode,
} from '@utils/index';
import { TransactionService } from '@modules/transaction/transaction.service';
import { BillService } from '@modules/bill/bill.service';
import { UserService } from '@modules/user/user.service';
import {
  CablePurchaseResponseDTO,
  CreateCableProviderDTO,
} from './dto/cable-purchase.dto';

@Injectable()
export class CablePurchaseService extends GenericService(CablePurchase) {
  constructor(
    private readonly userSrv: UserService,
    private readonly billSrv: BillService,
    private readonly transactionSrv: TransactionService,
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
      // Make purchase from flutterwave
      const narration = `Cable plan purchase (₦${plan.amount}) for ${payload.smartCardNumber}`;
      const transactionDate = new Date().toLocaleString();
      const reference = `Spraay-cable-${generateUniqueCode(10)}`;
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
