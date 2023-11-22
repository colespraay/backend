import {
  BadGatewayException,
  ConflictException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import {
  BaseResponseTypeDTO,
  TransactionType,
  checkForRequiredFields,
  formatTransactionKey,
  generateUniqueCode,
  httpGet,
  httpPost,
  validateUUIDField,
} from '@utils/index';
import { User } from '@entities/index';
import { BankService, UserService } from '../index';
import {
  BankAccountStatementDTO,
  BankListDTO,
  BankListPartialDTO,
  CreateFlutterwaveResponseDTO,
  FindStatementOfAccountDTO,
  FindTransferChargeDTO,
  InterbankTransferChargeDTO,
  MakeWalletDebitTypeDTO,
  TransactionNotificationResponseDTO,
  TransferResponseDTO,
  VerifiesAccountDetailDTO,
  VerifyAccountExistenceDTO,
  VerifyAccountExistenceResponseDTO,
  VerifyAccountExistenceResponsePartial,
} from './dto/wallet.dto';

@Injectable()
export class WalletService {
  private logger = new Logger();
  private bankStatementSubKey = String(
    process.env.WEMA_ATLAT_ACCOUNT_STATEMENT_SUB_KEY,
  );
  private walletCreationSubKey = String(
    process.env.WEMA_ATLAT_WALLET_CREATION_SUB_KEY,
  );
  private xApiKey = String(process.env.WEMA_ATLAT_X_API_KEY);

  constructor(
    private readonly userSrv: UserService,
    @Inject(forwardRef(() => BankService))
    private readonly bankSrv: BankService,
    private readonly eventEmitterSrv: EventEmitter2,
  ) {}

  @OnEvent('create-wallet', { async: true })
  async createWallet(userId: string): Promise<void> {
    try {
      checkForRequiredFields(['userId'], { userId });
      validateUUIDField(userId, 'userId');
      const url = 'https://api.flutterwave.com/v3/virtual-account-numbers';
      const user = await this.userSrv.findUserById(userId);
      checkForRequiredFields(
        ['firstName', 'lastName', 'email', 'bvn', 'phoneNumber'],
        user.data,
      );
      if (user?.data && !user.data.virtualAccountNumber) {
        const fullNameNarration = `${user.data.firstName} ${user.data.lastName}`;
        const userRef = formatTransactionKey(
          `Spraay-${fullNameNarration}-${generateUniqueCode(10)}`,
        );
        const payload = {
          bvn: user.data.bvn,
          email: user.data.email,
          is_permanent: true,
          tx_ref: userRef,
          phonenumber: user.data.phoneNumber,
          firstname: user.data.firstName,
          lastname: user.data.lastName,
          narration: fullNameNarration,
        };
        const flutterwaveResponse = await httpPost<
          CreateFlutterwaveResponseDTO,
          any
        >(url, payload, {
          Authorization: `Bearer ${String(process.env.FLUTTERWAVE_SECRET_KEY)}`,
        });
        this.logger.debug({ virtualAccount: flutterwaveResponse });
        if (flutterwaveResponse?.status) {
          const updatedUser: Partial<User> = {
            bankName: flutterwaveResponse.data.bank_name,
            virtualAccountName: fullNameNarration,
            virtualAccountNumber: flutterwaveResponse.data.account_number,
            flutterwaveNarration: fullNameNarration,
            flutterwaveUserKey: userRef,
          };
          await this.userSrv.getRepo().update({ id: userId }, updatedUser);
        }
      }
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async findBankByName(bankName: string): Promise<BankListPartialDTO> {
    try {
      const banks = await this.getBankLists();
      const bank = banks.data.find(
        (bank) => bank.name?.toUpperCase() === bankName?.toUpperCase(),
      );
      if (!bank?.code) {
        throw new NotFoundException(`Bank with name: ${bankName} not found`);
      }
      return bank;
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async findBankByCode(bankCode: string): Promise<BankListPartialDTO> {
    try {
      const banks = await this.getBankLists();
      const bank = banks.data.find((bank) => bank.code === bankCode);
      if (!bank?.code) {
        throw new NotFoundException(`Bank with code: ${bankCode} not found`);
      }
      return bank;
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async getBankLists(): Promise<BankListDTO> {
    try {
      const bankList = await this.bankSrv.getRepo().find({
        where: { status: true },
      });
      return {
        success: true,
        code: HttpStatus.OK,
        message: 'Bank list found',
        data: bankList.map(({ bankName, bankCode }) => ({
          name: bankName,
          code: bankCode,
        })),
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async getListOfInterbankTransferCharges(): Promise<FindTransferChargeDTO> {
    try {
      const url =
        'https://apiplayground.alat.ng/debit-wallet/api/Shared/GetNIPCharges';
      const data = await httpGet<any>(url, {
        'x-api-key': String(process.env.WEMA_ATLAT_X_API_KEY),
        'Ocp-Apim-Subscription-Key': String(
          process.env.WEMA_ATLAT_WALLET_CREATION_SUB_KEY,
        ),
      });
      return {
        success: true,
        code: HttpStatus.OK,
        message: 'Inter-bank charges found',
        termsAndConditions: data.result.termsAndConditions,
        termsAndConditionsUrl: data.result.termsAndConditionsUrl,
        data: data.result.chargeFees as InterbankTransferChargeDTO[],
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async verifyExternalAccountNumber(
    userBankCode: string,
    userAccountNumber: string,
  ): Promise<VerifiesAccountDetailDTO> {
    try {
      checkForRequiredFields(['userBankCode', 'userAccountNumber'], {
        userBankCode,
        userAccountNumber,
      });
      const url = 'https://api.flutterwave.com/v3/accounts/resolve';
      const payload = {
        account_number: userAccountNumber,
        account_bank: userBankCode,
      };
      const headers = {
        Authorization: `Bearer ${String(process.env.FLUTTERWAVE_SECRET_KEY)}`,
      };
      const resp = await httpPost<any, any>(url, payload, headers);
      if (resp?.status === 'success') {
        return {
          accountName: resp.data.account_name,
          accountNumber: resp.data.account_number,
          bankCode: userBankCode,
          currency: 'NGN',
        };
      }
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async verifyWalletAccountNumber(
    userAccountNumber: string,
    env = 'TEST',
  ): Promise<VerifiesAccountDetailDTO> {
    try {
      if (env === 'TEST') {
        return {
          accountName: 'James Osagie',
          accountNumber: userAccountNumber,
          bankCode: '035',
          currency: 'NGN',
        };
      }
      // Verify destination Account
      const destinationAccountEnquiryUrl = `https://apiplayground.alat.ng/debit-wallet/api/Shared/AccountNameEnquiry/Wallet/${userAccountNumber}`;
      const destinationAccount = await httpGet<any>(
        destinationAccountEnquiryUrl,
        {
          'Cache-Control': 'no-cache',
          access: String(process.env.WEMA_ATLAT_X_API_KEY),
          'Ocp-Apim-Subscription-Key': String(
            process.env.WEMA_ATLAT_WALLET_CREATION_SUB_KEY,
          ),
        },
      );
      if (!destinationAccount?.result) {
        throw new BadGatewayException('Could not verify wallet');
      }
      const {
        result: { accountName, accountNumber, bankCode, currency },
      } = destinationAccount;
      return {
        accountName,
        accountNumber,
        bankCode,
        currency,
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  // URL: https://playground.alat.ng/api-details#api=wallet-transfer-api&operation=get-api-shared-accountnameenquiry-bankcode-accountnumber
  async verifyAccountExistence(
    sourceAccountNumber: string,
    payload: VerifyAccountExistenceDTO,
  ): Promise<VerifyAccountExistenceResponseDTO> {
    try {
      checkForRequiredFields(
        [
          'sourceAccountNumber',
          'destinationBankCode',
          'destinationAccountNumber',
          'destinationAccountName',
        ],
        { ...payload, sourceAccountNumber },
      );
      try {
        const enquiryUrl = `https://apiplayground.alat.ng/debit-wallet/api/Shared/AccountNameEnquiry/Wallet/${sourceAccountNumber}`;
        const enquiryData = await httpGet(enquiryUrl, {
          access: String(process.env.WEMA_ATLAT_X_API_KEY),
          'Ocp-Apim-Subscription-Key': String(
            process.env.WEMA_ATLAT_WALLET_CREATION_SUB_KEY,
          ),
        });
        if (!enquiryData) {
          throw new BadGatewayException(
            `Could not verify source wallet: '${sourceAccountNumber}'`,
          );
        }
      } catch (ex) {
        this.logger.error(
          `Source account error: ${sourceAccountNumber}: ${ex}`,
        );
        throw ex;
      }

      // Verify destination Account
      const destinationAccountEnquiryUrl = `https://apiplayground.alat.ng/debit-wallet/api/Shared/AccountNameEnquiry/${
        payload.destinationBankCode
      }/${payload.destinationAccountNumber}?channelId=${String(
        process.env.WEMA_ATLAT_X_API_KEY,
      )}`;
      const destinationAccount = await httpGet<any>(
        destinationAccountEnquiryUrl,
        {
          'Cache-Control': 'no-cache',
          'Ocp-Apim-Subscription-Key': String(
            process.env.WEMA_ATLAT_WALLET_CREATION_SUB_KEY,
          ),
        },
      );
      if (!destinationAccount) {
        throw new BadGatewayException('Could not verify destination account');
      }
      const extractedData =
        destinationAccount.result as VerifyAccountExistenceResponsePartial;
      const bank = (await this.getBankLists()).data.find(
        (bank) => bank.code === extractedData.bankCode,
      );
      return {
        success: true,
        code: HttpStatus.OK,
        message: 'Accounts verified',
        data: { ...extractedData, bankName: bank?.name },
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  // URL: https://playground.alat.ng/api-details#api=wallet-transfer-api&operation=post-api-shared-processclienttransfer
  async makeTransferFromWallet(
    sourceAccountNumber: string,
    payload: MakeWalletDebitTypeDTO,
    env = 'TEST',
  ): Promise<TransferResponseDTO> {
    try {
      checkForRequiredFields(
        [
          'amount',
          'sourceAccountNumber',
          'destinationBankCode',
          'destinationBankName',
          'destinationAccountNumber',
          'destinationAccountName',
          'narration',
        ],
        { ...payload, sourceAccountNumber },
      );
      const transactionReference = `#Spraay-Ref-${generateUniqueCode(8)}`;
      const narration =
        payload.narration ??
        `Debit - Destination: [${payload.destinationBankName}] ${payload.destinationAccountNumber}`;
      let apiResponse = {
        result: {
          status: 'Successful',
          message: 'Transfer successful',
          narration,
          transactionReference,
          platformTransactionReference: transactionReference,
          transactionStan: 'string',
          orinalTxnTransactionDate: new Date().toLocaleString(),
        },
        errorMessage: null,
        errorMessages: [],
        hasError: true,
        timeGenerated: 'string',
      };
      if (env !== 'TEST') {
        const url =
          'https://apiplayground.alat.ng/debit-wallet/api/Shared/ProcessClientTransfer';
        apiResponse = await httpPost<any, any>(
          url,
          {
            // securityInfo: 'string',
            amount: payload.amount,
            destinationBankCode: payload.destinationBankCode,
            destinationBankName: payload.destinationBankName,
            destinationAccountNumber: payload.destinationAccountNumber,
            destinationAccountName: payload.destinationAccountName,
            sourceAccountNumber: sourceAccountNumber,
            narration,
            transactionReference,
            useCustomNarration: true,
          },
          {
            access: String(process.env.WEMA_ATLAT_X_API_KEY),
            'Cache-Control': 'no-cache',
            'Ocp-Apim-Subscription-Key': String(
              process.env.WEMA_ATLAT_WALLET_CREATION_SUB_KEY,
            ),
          },
        );
      }
      if (!apiResponse) {
        throw new BadGatewayException('Debit payment failed');
      }
      return {
        success: true,
        message: apiResponse.result.message,
        code: HttpStatus.OK,
        data: {
          narration: apiResponse.result.narration,
          orinalTxnTransactionDate: apiResponse.result.orinalTxnTransactionDate,
          platformTransactionReference:
            apiResponse.result.platformTransactionReference,
          transactionReference: apiResponse.result.transactionReference,
        },
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  // URL: (payment APIs) https://playground.alat.ng/api-details#api=pay-with-bank-account-api&operation=initiate-fund-transfer-request

  // URL: https://playground.alat.ng/api-details#api=get-statement-service&operation=getcustomertransactions
  async getStatementOfAccounts(
    accountNumber: string,
    payload: FindStatementOfAccountDTO,
  ): Promise<BankAccountStatementDTO> {
    try {
      checkForRequiredFields(['accountNumber', 'startDate', 'endDate'], {
        ...payload,
        accountNumber,
      });
      console.log({ accountNumber, payload });
      const userRecord = await this.userSrv.findOne({
        virtualAccountNumber: accountNumber,
      });
      if (!userRecord?.id) {
        throw new NotFoundException('User with account not found');
      }

      try {
        const url =
          'https://apiplayground.alat.ng/get-statement-service/api/AccountMaintenance/InitiateGetCustomerStatement';
        const responseData = await httpPost<any, any>(
          url,
          {
            accountNumber,
            dateFrom: new Date(payload.startDate),
            dateTo: new Date(payload.endDate),
          },
          {
            'Ocp-Apim-Subscription-Key': this.bankStatementSubKey,
            'x-api-key': this.xApiKey,
          },
        );
        if (responseData?.referenceId) {
          const bankStatementUrl =
            'https://apiplayground.alat.ng/get-statement-service/api/AccountMaintenance/GetCustomerTransactions';
          return await httpPost<BankAccountStatementDTO, any>(
            bankStatementUrl,
            {
              referenceId: responseData.referenceId,
            },
            {
              'Ocp-Apim-Subscription-Key': this.bankStatementSubKey,
              'x-api-key': this.xApiKey,
            },
          );
        }
      } catch (ex) {
        this.logger.error(ex);
        return {
          message: 'Statement of accounts list',
          status: true,
          data: [],
        };
      }
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async webhookHandler(payload: any): Promise<void> {
    try {
      if (payload.event === 'charge.completed') {
        // User funds their wallet
        const data = payload.data;
        if (data?.tx_ref) {
          const userRecord = await this.userSrv.getRepo().findOne({
            where: { flutterwaveUserKey: data.tx_ref },
            select: ['id', 'walletBalance'],
          });
          if (userRecord?.id) {
            const amount = parseFloat(data.amount);
            this.eventEmitterSrv.emit('transaction.log', {
              type: TransactionType.CREDIT,
              userId: userRecord.id,
              narration: data.narration,
              transactionDate: data.created_at,
              currentBalanceBeforeTransaction: userRecord.walletBalance,
              amount,
            });
            this.eventEmitterSrv.emit('wallet.credit', {
              userId: userRecord.id,
              amount,
            });
          }
        }
      }
      // Handle transfers
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  // URL: https://playground.alat.ng/api-transaction-notification
  async transactionNotificationWebhookHandler(
    payload: TransactionNotificationResponseDTO,
  ): Promise<void> {
    try {
      console.log({ body: payload });
      const user = await this.userSrv.findOne({
        virtualAccountNumber: payload.accountNumber,
      });
      if (user?.id) {
        switch (payload.transactionType) {
          case TransactionType.CREDIT:
            this.eventEmitterSrv.emit('transaction.log', {
              type: TransactionType.CREDIT,
              userId: user.id,
              narration: payload.narration,
              amount: payload.amount,
              transactionDate: payload.transactionDate,
              currentBalanceBeforeTransaction: user.walletBalance,
            });
            break;
          case TransactionType.DEBIT:
            this.eventEmitterSrv.emit('transaction.log', {
              type: TransactionType.DEBIT,
              userId: user.id,
              narration: payload.narration,
              amount: payload.amount,
              transactionDate: payload.transactionDate,
              currentBalanceBeforeTransaction: user.walletBalance,
            });
            break;
        }
      }
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }
}
