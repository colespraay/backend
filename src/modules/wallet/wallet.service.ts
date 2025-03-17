import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import {
  BadGatewayException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AxiosError } from 'axios';
import { Request } from 'express';
import {
  PaymentStatus,
  TransactionType,
  calculateAppCut,
  checkForRequiredFields,
  compareEnumValueFields,
  formatPagaDate,
  generatePagaHash,
  generateUniqueCode,
  httpGet,
  httpPost,
  validateUUIDField,
} from '@utils/index';
import { User } from '@entities/index';
import { UserService } from '@modules/user/user.service';
import { BankService } from '@modules/bank/bank.service';
import { WithdrawalService } from '@modules/withdrawal/withdrawal.service';
import { TransactionService } from '@modules/transaction/transaction.service';
import { UserAccountService } from '@modules/user-account/user-account.service';
import {
  BankAccountStatementDTO,
  BankListDTO,
  BankListPartialDTO,
  FindStatementOfAccountDTO,
  FindTransferChargeDTO,
  InterbankTransferChargeDTO,
  MakeWalletDebitTypeDTO,
  TransactionFeeBreakdownDTO,
  TransactionFeeType,
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
  private percentageAppFee = Number(process.env.APP_TRANSACTION_FEE) ?? 0;

  constructor(
    private readonly userSrv: UserService,
    private readonly bankSrv: BankService,
    private readonly eventEmitterSrv: EventEmitter2,
    private readonly withdrawalSrv: WithdrawalService,
    private readonly userAccountSrv: UserAccountService,
    private readonly transactionSrv: TransactionService,
  ) {}

  async getAccountBalance(): Promise<{
    totalBalance: number;
    availableBalance: number;
    message: string;
  }> {
    try {
      const url = `${process.env.PAGA_BASE_URL}/accountBalance`;
      const referenceNumber = generateUniqueCode(13);
      const body = { referenceNumber, locale: 'EN' };
      const hashKey = ['referenceNumber'];
      const { hash, password, username } = generatePagaHash(hashKey, body);
      const headers = {
        hash,
        principal: username,
        credentials: password,
        'Content-Type': 'application/json',
      };
      const response = await httpPost<any, any>(url, body, headers);
      if (response?.totalBalance) {
        return {
          message: response.message,
          availableBalance: Number(response.availableBalance),
          totalBalance: Number(response.totalBalance),
        };
      }
      throw new BadGatewayException('Could not find balance');
    } catch (ex) {
      if (ex instanceof AxiosError) {
        const errorObject = ex.response.data;
        const message =
          typeof errorObject === 'string'
            ? errorObject
            : errorObject.statusMessage;
        this.logger.error(message);
        throw new HttpException(
          message,
          Number(errorObject.statusCode) ?? HttpStatus.BAD_GATEWAY,
        );
      } else {
        this.logger.error(ex);
        throw ex;
      }
    }
  }

  @OnEvent('create-wallet', { async: true })
  async createWallet(payload: { userId: string; req: Request }): Promise<void> {
    try {
      checkForRequiredFields(['userId', 'req'], payload);
      validateUUIDField(payload.userId, 'userId');
      const user = await this.userSrv.findUserById(payload.userId);
      const {
        data: { firstName, lastName, bvn, phoneNumber },
      } = user;
      if (firstName && lastName && bvn && phoneNumber) {
        const url = `${process.env.PAGA_COLLECT_URL}/registerPersistentPaymentAccount`;
        const hashKeys = [
          'referenceNumber',
          'accountReference',
          'creditBankId',
          'creditBankAccountNumber',
          'callbackUrl',
        ];
        const callbackUrl =
          payload.req.protocol && payload.req.get('host')
            ? `${payload.req.protocol}://${payload.req.get(
                'host',
              )}/wallet/webhook`
            : String(process.env.PAGA_WEBHOOK);
        const referenceNumber = generateUniqueCode(13);
        const requestBody = {
          referenceNumber,
          phoneNumber,
          firstName,
          lastName,
          accountName: `${firstName} ${lastName}`,
          accountReference: referenceNumber,
          callbackUrl,
        };
        const { hash } = generatePagaHash(hashKeys, requestBody);
        const headers = {
          hash,
          Authorization: `Basic ${process.env.PAGA_AUTH_TOKEN}`,
          'Content-Type': 'application/json',
        };
        const response = await httpPost<any, any>(url, requestBody, headers);
        console.log("PAGA ACCOUNT CREATION",response)
        if (response?.statusMessage === 'success') {
          const updatedUser: Partial<User> = {
            bankName: 'PAGA',
            virtualAccountName: `${process.env.APP_COMPANY_NAME} - ${requestBody.accountName}`,
            virtualAccountNumber: response.accountNumber,
          };
          await this.userSrv
            .getRepo()
            .update({ id: payload.userId }, updatedUser);
        }
      }
    } catch (ex) {
      if (ex instanceof AxiosError) {
        const errorObject = ex.response.data;
        const message =
          typeof errorObject === 'string'
            ? errorObject
            : errorObject.statusMessage;
        this.logger.error(message);
        throw new HttpException(
          message,
          Number(errorObject.statusCode) ?? HttpStatus.BAD_GATEWAY,
        );
      } else {
        this.logger.error(ex);
        throw ex;
      }
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

  async getBankLists(searchTerm?: string): Promise<BankListDTO> {
    try {
      let bankList = await this.bankSrv.getRepo().find({
        where: { status: true },
        order: { bankName: 'ASC' },
      });
      if (searchTerm) {
        searchTerm = searchTerm.toLowerCase();
        bankList = bankList.filter(
          ({ bankName, bankCode }) =>
            bankName.toLowerCase().includes(searchTerm) ||
            bankCode.toLowerCase().includes(searchTerm),
        );
      }
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

  async calculateTransactionFee(
    amount: number,
    type: TransactionFeeType = TransactionFeeType.WITHDRAWAL,
  ): Promise<TransactionFeeBreakdownDTO> {
    try {
      checkForRequiredFields(['amount', 'type'], { amount, type });
      compareEnumValueFields(type, Object.values(TransactionFeeType), 'type');
      const response = new TransactionFeeBreakdownDTO();
      let total = amount;
      const headers = {
        Authorization: `Bearer ${String(process.env.FLUTTERWAVE_SECRET_KEY)}`,
      };
      if (type === TransactionFeeType.WITHDRAWAL) {
        type ResponseType = {
          status: string;
          message: string;
          data: {
            fee_type: string;
            currency: string;
            fee: number;
          }[];
        };
        const url = `https://api.flutterwave.com/v3/transfers/fee?amount=${amount}&currency=NGN`;
        const result = await httpGet<ResponseType>(url, headers);
        if (result?.data) {
          const flutterwaveFee = Number(
            result.data.find(({ currency }) => currency === 'NGN')?.fee,
          );
          total -= flutterwaveFee;
          response.flutterwaveCharge = parseFloat(flutterwaveFee.toFixed(2));
        }
      }
      if (type === TransactionFeeType.TOP_UP) {
        type ResponseType = {
          status: string;
          message: string;
          data: {
            charge_amount: number;
            fee: number;
            merchant_fee: number;
            flutterwave_fee: number;
            stamp_duty_fee: number;
            currency: string;
          };
        };
        const url = `https://api.flutterwave.com/v3/transactions/fee?amount=${amount}&currency=NGN`;
        const result = await httpGet<ResponseType>(url, headers);
        if (result?.data) {
          const charge =
            Number(result.data.flutterwave_fee) +
            Number(result.data.stamp_duty_fee);
          total -= charge;
          response.flutterwaveCharge = parseFloat(charge.toFixed(2));
        }
      }
      const amountDeductible = calculateAppCut(this.percentageAppFee, total);
      response.amountDeductible = parseFloat(amountDeductible.toFixed(2));
      const spraayCharge =
        amount - (amountDeductible + response.flutterwaveCharge) ?? 0;
      response.spraayCharge = parseFloat(spraayCharge.toFixed(2));
      return response;
    } catch (ex) {
      if (ex instanceof AxiosError) {
        const errorObject = ex.response.data;
        throw new HttpException(errorObject.message, ex.response.status);
      } else {
        this.logger.error(ex);
        throw ex;
      }
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
      const url = `${process.env.PAGA_BASE_URL}/validateDepositToBank`;
      const hashKeys = [
        'referenceNumber',
        'amount',
        'destinationBankUUID',
        'destinationBankAccountNumber',
      ];
      const amount = '50';
      const referenceNumber = '23453498574985830';
      const requestBody = {
        referenceNumber,
        amount,
        currency: 'NGN',
        destinationBankUUID: userBankCode,
        destinationBankAccountNumber: userAccountNumber,
      };
      const { hash, password, username } = generatePagaHash(
        hashKeys,
        requestBody,
      );
      const headers = {
        hash,
        principal: username,
        credentials: password,
        'Content-Type': 'application/json',
      };
      const response = await httpPost<any, any>(url, requestBody, headers);
      if (response?.destinationAccountHolderNameAtBank) {
        const bank = await this.bankSrv.findOne({ bankCode: userBankCode });
        return {
          accountName: response.destinationAccountHolderNameAtBank,
          accountNumber: userAccountNumber,
          bankCode: bank.bankCode,
          currency: 'NGN',
        };
      }
      throw new NotFoundException('Could not verify account');
    } catch (ex) {
      if (ex instanceof AxiosError) {
        const errorObject = ex.response.data;
        const message =
          typeof errorObject === 'string' ? errorObject : errorObject.error;
        this.logger.error(message);
        throw new HttpException(message, ex.response.status);
      } else {
        this.logger.error(ex);
        throw ex;
      }
    }
  }

  async verifyWalletAccountNumber(
    userAccountNumber: string,
    env = 'PROD',
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
    env = 'PROD',
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

  // ===== Paga response
  // {
  //   statusCode: '0',
  //   statusMessage: 'success',
  //   transactionReference: 'DFB-U_20240325121426747_551681845_H3ZDQ_z456b',
  //   fundingPaymentReference: 'S22607128',
  //   accountNumber: '3206420520',
  //   accountName: 'Abel Ani',
  //   financialIdentificationNumber: null,
  //   amount: '250.00',
  //   clearingFeeAmount: '1.88',
  //   payerDetails: {
  //     paymentReferenceNumber: '000003240325121230002969709827 - S22607128',
  //     narration: 'Appfund wallet To Paga Spraay Software Limited  Abel Ani',
  //     paymentMethod: 'BANK_TRANSFER',
  //     payerName: 'ANI ABEL CHIDIEBERE',
  //     payerBankName: 'FCMB',
  //     payerBankAccountNumber: '6881408019'
  //   },
  //   hash: 'a277843f58d1e3fe27f91045ae6a8a3fc889c596aa95ed7e6eeed407393b830fe66ab3bf86be50d2883fa463e8df120e3003efe34815a1211d20c419de1377ea'
  // }
  async webhookHandler(payload: any): Promise<void> {
    try {
      this.logger.debug({ webhookPayload: payload });
      if (payload.statusCode === '0' && payload.statusMessage === 'success') {
        const user = await this.userSrv.getRepo().findOne({
          where: { virtualAccountNumber: payload.accountNumber },
        });
        if (user?.id) {
          const currentBalanceBeforeTransaction =
            await this.userSrv.getCurrentWalletBalance(user.id);
          const reference = String(payload.payerDetails.paymentReferenceNumber);
          const narration =
            payload.payerDetails?.narration ??
            `${payload.fundingPaymentReference} - Wallet Funded`;
          const pagaCharge = parseFloat(payload.clearingFeeAmount);
          // const amount = parseFloat(payload.amount) - pagaCharge;
          const amount = parseFloat(payload.amount) 
          const transactionDate = new Date().toLocaleString();
          const newTransaction = await this.transactionSrv.createTransaction({
            amount,
            reference,
            narration,
            type: TransactionType.CREDIT,
            transactionStatus: PaymentStatus.SUCCESSFUL,
            userId: user.id,
            transactionDate,
            jsonResponse: payload,
            currentBalanceBeforeTransaction,
          });
          this.logger.debug({ newTransaction, narration, reference });
        }
      }
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async checkTransactions(): Promise<void> {
    try {
      const url = `${process.env.PAGA_BASE_URL}/transactionHistory`;
      // Get the current timestamp
      const currentTime = new Date();

      // Calculate the timestamp for 1 day ago
      const fromDate = new Date(currentTime);
      fromDate.setDate(currentTime.getDate() - 1);
      const hashKey = ['referenceNumber'];
      const requestBody = {
        referenceNumber: '123456789',
        startDateUTC: formatPagaDate(fromDate),
        endDateUTC: formatPagaDate(currentTime),
        locale: 'EN',
      };
      const { hash, password, username } = generatePagaHash(
        hashKey,
        requestBody,
      );
      const headers = {
        hash,
        principal: username,
        credentials: password,
        'Content-Type': 'application/json',
      };
      const response = await httpPost<any, any>(url, requestBody, headers);
      if (response.responseCode === '0') {
        console.log({ response: response.items });
      }
    } catch (ex) {
      if (ex instanceof AxiosError) {
        const errorObject = ex.response?.data;
        const message =
          typeof errorObject === 'string' ? errorObject : errorObject.error;
        this.logger.error(message);
      } else {
        this.logger.error(ex);
      }
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
        const transactionDate = new Date(
          payload.transactionDate,
        ).toLocaleString();
        switch (payload.transactionType) {
          case TransactionType.CREDIT:
            await this.transactionSrv.createTransaction({
              type: TransactionType.CREDIT,
              userId: user.id,
              narration: payload.narration,
              amount: payload.amount,
              transactionDate,
              currentBalanceBeforeTransaction: user.walletBalance,
            });
            break;
          case TransactionType.DEBIT:
            await this.transactionSrv.createTransaction({
              type: TransactionType.DEBIT,
              userId: user.id,
              narration: payload.narration,
              amount: payload.amount,
              transactionDate,
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
