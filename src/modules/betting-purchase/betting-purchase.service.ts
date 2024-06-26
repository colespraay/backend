import {
  BadGatewayException,
  ConflictException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import {
  TransactionType,
  checkForRequiredFields,
  generateUniqueCode,
} from '@utils/index';
import { BettingPurchase, User } from '@entities/index';
import { GenericService } from '@schematics/index';
import { BillService } from '@modules/bill/bill.service';
import { UserService } from '@modules/user/user.service';
import { WalletService } from '@modules/wallet/wallet.service';
import { TransactionService } from '@modules/transaction/transaction.service';
import {
  BettingPurchaseResponseDTO,
  CreateBettingPurchaseDTO,
} from './dto/betting-purchase.dto';

@Injectable()
export class BettingPurchaseService extends GenericService(BettingPurchase) {
  constructor(
    private readonly billSrv: BillService,
    private readonly userSrv: UserService,
    private readonly walletSrv: WalletService,
    private readonly transactionSrv: TransactionService,
  ) {
    super();
  }

  async fundBettingWallet(
    payload: CreateBettingPurchaseDTO,
    user: User,
  ): Promise<BettingPurchaseResponseDTO> {
    try {
      checkForRequiredFields(
        ['amount', 'transactionPin', 'providerId', 'bettingWalletId'],
        payload,
      );
      await this.userSrv.verifyTransactionPin(user.id, payload.transactionPin);
      if (payload?.merchantPlan) {
        const plan = await this.billSrv.findMerchantPlan(
          payload.providerId,
          payload.merchantPlan,
        );
        this.logger.debug({ plan });
      }
      await this.userSrv.checkAccountBalance(payload.amount, user.id);
      const { availableBalance } = await this.walletSrv.getAccountBalance();
      if (availableBalance < Number(payload.amount)) {
        throw new ConflictException('Insufficient balance');
      }
      const narration = `Betting wallet funded with (₦${payload.amount})`;
      const transactionDate = new Date().toLocaleString();
      const reference = `Spraay-betting-${generateUniqueCode(10)}`;
      const bettingPurchaseResponse = await this.billSrv.fundBettingWallet(
        { ...payload },
        reference,
      );
      this.logger.log({ bettingPurchaseResponse });
      if (!bettingPurchaseResponse?.success) {
        throw new BadGatewayException('Wallet funding failed');
      }
      const newTransaction = await this.transactionSrv.createTransaction({
        narration,
        userId: user.id,
        transactionDate,
        amount: payload.amount,
        type: TransactionType.DEBIT,
        reference: bettingPurchaseResponse.data.reference,
        currentBalanceBeforeTransaction: user.walletBalance,
      });
      const createdBettingPurchase = await this.create<
        Partial<BettingPurchase>
      >({
        amount: payload.amount,
        userId: user.id,
        providerId: payload.providerId,
        bettingWalletId: payload.bettingWalletId,
        transactionId: newTransaction.data.id,
      });
      this.logger.debug({ createdBettingPurchase });
      return {
        success: true,
        code: HttpStatus.CREATED,
        data: createdBettingPurchase,
        message: bettingPurchaseResponse.message,
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }
}
