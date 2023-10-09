import {
  BadGatewayException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import {
  TransactionType,
  addLeadingZeroes,
  checkForRequiredFields,
  generateRandomName,
  generateRandomNumber,
  generateUniqueCode,
  httpGet,
  httpPost,
  validateEmailField,
} from '@utils/index';
import { BankService, UserService } from '../index';
import {
  BankAccountStatementDTO,
  BankListDTO,
  BankListPartialDTO,
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
  WebhookResponseDTO,
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

  // URL: https://playground.alat.ng/api-details#api=wallet-creation-api&operation=generate-account-for-partnership
  @OnEvent('create-wallet', { async: true })
  async createWallet(userId: string): Promise<void> {
    try {
      const user = await this.userSrv.findOne({ id: userId });
      if (!user?.id) {
        throw new NotFoundException();
      }
      checkForRequiredFields(
        ['dob', 'email', 'gender', 'firstName', 'lastName', 'phoneNumber'],
        user,
      );
      validateEmailField(user.email);
      if (!user.virtualAccountNumber) {
        // initiate wallet creation
        const dob = new Date(user.dob);
        const formatDOB = `${dob.getFullYear()}-${addLeadingZeroes(
          dob.getMonth() + 1,
        )}-${addLeadingZeroes(dob.getDate())}`;
        const url =
          'https://apiplayground.alat.ng/wallet-creation/api/CustomerAccount/GenerateAccountForPatnerships';
        await httpPost(
          url,
          {
            gender: user.gender.toLowerCase(),
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            dob: formatDOB, // dob: '1994-10-17',
            phoneNumber: user.phoneNumber,
          },
          {
            'Ocp-Apim-Subscription-Key': this.walletCreationSubKey,
            'x-api-key': this.xApiKey,
          },
        );

        // Get the records for the accounts every 5 mins
        setTimeout(async () => {
          const url = `https://apiplayground.alat.ng/wallet-creation/api/CustomerAccount/GetPartnershipAccountDetails?phoneNumber=${user.phoneNumber}`;
          const walletData = await httpGet<any>(url, {
            'Ocp-Apim-Subscription-Key': this.walletCreationSubKey,
            'x-api-key': this.xApiKey,
          });
          this.logger.log({ walletData });
          const accountCreationPayload = {
            bankName: 'WEMA BANK',
            virtualAccountNumber:
              walletData?.data?.accountNumber ?? generateRandomNumber(),
            virtualAccountName:
              user.firstName && user.lastName
                ? `${user.firstName} ${user.lastName}`
                : generateRandomName(),
          };
          this.logger.log({ accountCreationPayload });
          // Save account details for user
          await this.userSrv
            .getRepo()
            .update({ id: user.id }, accountCreationPayload);
        }, 5000);
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
        (bank) => bank.bankName?.toUpperCase() === bankName?.toUpperCase(),
      );
      if (!bank?.bankCode) {
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
      const bank = banks.data.find((bank) => bank.bankCode === bankCode);
      if (!bank?.bankCode) {
        throw new NotFoundException(`Bank with code: ${bankCode} not found`);
      }
      return bank;
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  // https://apiplayground.alat.ng/debit-wallet/api/Shared/GetAllBanks
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
          bankName,
          bankCode,
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
      // Verify destination Account
      const destinationAccountEnquiryUrl = `https://apiplayground.alat.ng/debit-wallet/api/Shared/AccountNameEnquiry/${userBankCode}/${userAccountNumber}?channelId=${String(
        process.env.WEMA_ATLAT_X_API_KEY,
      )}`;
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
        throw new BadGatewayException('Could not verify account');
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

  async verifyWalletAccountNumber(
    userAccountNumber: string,
    env = 'TEST',
  ): Promise<VerifiesAccountDetailDTO> {
    try {
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
      if (env === 'TEST') {
        throw new NotFoundException('Could not verify wallet');
      }
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
        (bank) => bank.bankCode === extractedData.bankCode,
      );
      return {
        success: true,
        code: HttpStatus.OK,
        message: 'Accounts verified',
        data: { ...extractedData, bankName: bank?.bankName },
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

  // URL: https://playground.alat.ng/api-wallet-creation
  async webhookHandler(payload: WebhookResponseDTO): Promise<void> {
    try {
      console.log({ body: payload });
      const user = await this.userSrv.getRepo().findOne({
        where: { email: payload.Data.Email?.toUpperCase() },
      });
      if (user?.id) {
        if (
          !user.virtualAccountNumber &&
          user.virtualAccountNumber !== payload.Data.Nuban
        ) {
          user.virtualAccountNumber = payload.Data.Nuban;
          user.virtualAccountName = payload.Data.NubanName;
          user.bankCustomerId = payload.Data.CustomerID;
        }
        await this.userSrv.getRepo().update(
          { id: user.id },
          {
            virtualAccountNumber: user.virtualAccountNumber,
            virtualAccountName: user.virtualAccountName,
            bankCustomerId: user.bankCustomerId,
          },
        );
      }
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
