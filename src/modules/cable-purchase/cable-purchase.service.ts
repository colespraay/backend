import { BadGatewayException, ConflictException, HttpStatus, Injectable } from '@nestjs/common';
import { CablePurchase, User } from '@entities/index';
import { GenericService } from '@schematics/index';
import {
  checkForRequiredFields,
  TransactionType,
  generateUniqueCode,
} from '@utils/index';
import { TransactionService } from '@modules/transaction/transaction.service';
import { WalletService } from '@modules/wallet/wallet.service';
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
    private readonly walletSrv: WalletService,
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
          'providerId',
          'cablePlanId',
        ],
        payload,
      );
      await this.userSrv.verifyTransactionPin(user.id, payload.transactionPin);
      const plan = await this.billSrv.findMerchantPlan(
        payload.providerId,
        payload.cablePlanId,
      );
      await this.userSrv.checkAccountBalance(payload.amount, user.id);
      const { availableBalance } = await this.walletSrv.getAccountBalance();
      if (availableBalance < Number(plan.price)) {
        throw new ConflictException('Insufficient balance');
      }
      const narration = `Cable plan purchase (₦${plan.price}) for ${payload.smartCardNumber}`;
      const transactionDate = new Date().toLocaleString();
      const reference = `Spraay-cable-${generateUniqueCode(10)}`;
      const cablePurchaseResponse = await this.billSrv.makeCablePlanPurchase(
        {
          decoderNumber: payload.smartCardNumber,
          merchantServiceCode: payload.cablePlanId,
          providerId: payload.providerId,
        },
        reference,
        plan,
      );
      this.logger.log({ cablePurchaseResponse, plan });
      if (!cablePurchaseResponse?.success) {
        throw new BadGatewayException('Cable plan purchase failed');
      }
      const newTransaction = await this.transactionSrv.createTransaction({
        narration,
        userId: user.id,
        transactionDate,
        amount: plan.price,
        type: TransactionType.DEBIT,
        reference: cablePurchaseResponse.data.reference,
        currentBalanceBeforeTransaction: user.walletBalance,
      });
      const createdCablePlanPurchase = await this.create<
        Partial<CablePurchase>
      >({
        amount: plan.price,
        userId: user.id,
        providerId: payload.providerId,
        smartCardNumber: payload.smartCardNumber,
        cablePlanId: plan.shortCode,
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
