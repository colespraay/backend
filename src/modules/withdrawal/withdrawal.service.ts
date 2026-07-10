import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  BadGatewayException,
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
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
import { UserAccountService, UserService, WalletService } from '../index';
import {
  WithdrawalResponseDTO,
  CreateWithdrawalDTO,
} from './dto/withdrawal.dto';

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
    // Pass a logger label to the GenericService constructor as required
    super('WithdrawalService'); 
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
      
      const destinationAccount = await this.walletSrv.verifyExternalAccountNumber(
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
      const amountSettled = calculateAppCut(this.percentageAppFee, payload.amount);
      const referenceNumber = generateUniqueCode(13);
      const narration = `Wallet payout of ₦${formatAmount(payload.amount)} to ${destinationAccount.accountName}`;

      // 1. DEDUCT MONEY IMMEDIATELY
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
        bankName: payload.bankName,
        accountName: destinationAccount.accountName,
        accountNumber: payload.accountNumber,
      });

      // 2. SAVE WITHDRAWAL AS PENDING (DO NOT CALL PAGA YET)
      const createdWithdrawal = await this.create<Partial<Withdrawal>>({
        userId,
        amount: payload.amount,
        paymentStatus: PaymentStatus.PENDING, // Changed to PENDING
        userAccountId: bank.id,
        reference: referenceNumber,
        transactionId: newTransaction.data.id,
        // transferId will be saved later when admin approves
      });

      return {
        success: true,
        code: HttpStatus.CREATED,
        message: 'Withdrawal request submitted successfully. Awaiting admin approval.',
        data: createdWithdrawal,
      };
    } catch (ex) {
      if (ex instanceof AxiosError) {
        const errorObject = ex.response.data;
        const message =
          typeof errorObject === 'string'
            ? errorObject
            : errorObject.errorMessage;
        this.logger.error(message);
        throw new HttpException(message, ex.response.status);
      } else {
        this.logger.error(ex);
        throw ex;
      }
    }
  }

  // --- NEW ADMIN METHODS ---

  async getPendingWithdrawals(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;
    
    // Use this.getRepo() to access native TypeORM methods for pagination
    const [data, total] = await this.getRepo().findAndCount({
      where: { paymentStatus: PaymentStatus.PENDING },
      relations: ['user', 'userAccount', 'transaction'],
      skip,
      take: limit,
      // Cast to 'any' to bypass the TypeScript error. 
      // If your Base entity uses a different name (like 'created_at' or 'dateCreated'), 
      // change 'createdAt' to the exact property name used in your code.
      order: { createdAt: 'DESC' } as any, 
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async approveWithdrawal(withdrawalId: string) {
    // Use this.getRepo() to fetch with relations
    const withdrawal = await this.getRepo().findOne({
      where: { id: withdrawalId },
      relations: ['user', 'userAccount'],
    });

    if (!withdrawal) {
      throw new NotFoundException('Withdrawal request not found');
    }
    if (withdrawal.paymentStatus !== PaymentStatus.PENDING) {
      throw new ConflictException('Withdrawal request is not in pending status');
    }

    const user = withdrawal.user;
    const bank = withdrawal.userAccount;

    // 1. CALL PAGA API NOW
    const hashKeys = [
      'referenceNumber',
      'amount',
      'destinationBankUUID',
      'destinationBankAccountNumber',
    ];
    const url = `${process.env.PAGA_BASE_URL}/depositToBank`;
    const narration = `Wallet payout of ₦${formatAmount(withdrawal.amount)} to ${bank.accountName}`;

    const requestBody = {
      referenceNumber: withdrawal.reference,
      amount: String(withdrawal.amount),
      currency: 'NGN',
      destinationBankUUID: bank.bankCode,
      destinationBankAccountNumber: bank.accountNumber,
      recipientPhoneNumber: user.formattedPhoneNumber,
      remarks: narration,
    };

    const { hash, username, password } = generatePagaHash(hashKeys, requestBody);
    const headers = {
      hash,
      principal: username,
      credentials: password,
      'Content-Type': 'application/json',
    };

    try {
      const response = await httpPost<any, any>(url, requestBody, headers);
      this.logger.debug({ response, requestBody });

      if (!response?.destinationAccountHolderNameAtBank) {
        throw new BadGatewayException('Withdrawal failed on Paga');
      }

      // 2. UPDATE STATUS TO SUCCESSFUL using the underlying repository
      await this.getRepo().update(withdrawalId, {
        paymentStatus: PaymentStatus.SUCCESSFUL,
        transferId: response.transactionId,
      });

      return {
        success: true,
        message: 'Withdrawal approved and processed successfully on Paga',
      };
    } catch (ex) {
      this.logger.error('Paga withdrawal failed during admin approval', ex);
      throw new BadGatewayException('Failed to process withdrawal on Paga');
    }
  }

  async declineWithdrawal(withdrawalId: string) {
    // Use this.getRepo() to fetch with relations
    const withdrawal = await this.getRepo().findOne({
      where: { id: withdrawalId },
      relations: ['transaction'],
    });

    if (!withdrawal) {
      throw new NotFoundException('Withdrawal request not found');
    }
    if (withdrawal.paymentStatus !== PaymentStatus.PENDING) {
      throw new ConflictException('Withdrawal request is not in pending status');
    }

    // 1. REFUND MONEY TO USER WALLET
    const refundReference = generateUniqueCode(13);
    const narration = `Refund for declined withdrawal ${withdrawal.reference}`;
    
    await this.transactionSrv.createTransaction({
      userId: withdrawal.userId,
      amount: withdrawal.amount,
      reference: refundReference,
      narration,
      type: TransactionType.CREDIT,
      transactionStatus: PaymentStatus.SUCCESSFUL,
      transactionDate: new Date().toLocaleString(),
      currentBalanceBeforeTransaction: 0, // TODO: Fetch actual current balance if your transaction logic requires it
    });

    // 2. UPDATE STATUS TO DECLINED using the underlying repository
    // Note: Ensure 'DECLINED' exists in your PaymentStatus enum. If not, use 'FAILED'.
    await this.getRepo().update(withdrawalId, {
      paymentStatus: PaymentStatus.FAILED, // or PaymentStatus.DECLINED if you have that status
    });

    return {
      success: true,
      message: 'Withdrawal declined and funds refunded to user wallet',
    };
  }
}