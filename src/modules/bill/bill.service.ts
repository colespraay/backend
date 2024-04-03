import {
  BadGatewayException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { AxiosError } from 'axios';
import {
  CableProvider,
  checkForRequiredFields,
  compareEnumValueFields,
  generatePagaHash,
  httpGet,
  httpPost,
} from '@utils/index';
import { CreateFlutterwaveDataPurchaseDTO } from '@modules/data-purchase/dto/data-purchase.dto';
import { CreateAirtimePurchaseDTO } from '@modules/airtime-purchase/dto/airtime-purchase.dto';
import { CreateElectricityPurchaseDTO } from '@modules/electricity-purchase/dto/electricity-purchase.dto';
import {
  BillProviderDTO,
  BillProviderPartial,
  CablePaymentRequestDTO,
  FlutterwaveBillItemVerificationResponseDTO,
  FlutterwaveBillPaymentResponseDTO,
  FlutterwaveCableBillingOptionPartial,
  FlutterwaveCableBillingOptionResponseDTO,
  PagaCablePaymentResponseDTO,
  PagaDataPlanDTO,
  PagaDataPlanPartial,
  PagaMerchantPlanPartial,
  PagaMerchantPlanResponseDTO,
  PagaMeterDetailDTO,
} from './dto/bill.dto';
import { CreateBettingPurchaseDTO } from '@modules/betting-purchase/dto/betting-purchase.dto';

@Injectable()
export class BillService implements OnModuleInit {
  private readonly logger = new Logger(BillService.name);
  private readonly flutterwaveSecretKey = String(
    process.env.FLUTTERWAVE_SECRET_KEY,
  );
  private electricityProviders: any;

  async onModuleInit() {
    try {
      const url =
        'https://api.flutterwave.com/v3/bill-categories?power=1&country=NG';
      this.electricityProviders = await httpGet<any>(url, {
        Authorization: `Bearer ${String(process.env.FLUTTERWAVE_SECRET_KEY)}`,
      });
    } catch (ex) {
      if (ex instanceof AxiosError) {
        const errorObject = ex.response.data;
        const message =
          typeof errorObject === 'string' ? errorObject : errorObject.message;
        this.logger.error(message);
      } else {
        this.logger.error(ex);
      }
    }
  }

  async findCableProviderById(
    cablePlanId: number,
  ): Promise<FlutterwaveCableBillingOptionPartial> {
    try {
      const plans = await this.findCableProviderOptions();
      const selectedPlan = plans.data.find((item) => item.id === cablePlanId);
      if (!selectedPlan) {
        throw new NotFoundException(
          `Cable plan with id: '${cablePlanId}' not found`,
        );
      }
      return selectedPlan;
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async findCableProviderOptions(
    provider?: CableProvider,
  ): Promise<FlutterwaveCableBillingOptionResponseDTO> {
    try {
      if (provider) {
        compareEnumValueFields(
          provider,
          Object.values(CableProvider),
          'provider',
        );
      }
      const url =
        'https://api.flutterwave.com/v3/bill-categories?cable=1&country=NG';
      const allPlans = await httpGet<any>(url, {
        Authorization: `Bearer ${this.flutterwaveSecretKey}`,
      });
      let plans: FlutterwaveCableBillingOptionPartial[] =
        allPlans.data as any[];
      if (provider) {
        plans = (allPlans.data as any[]).filter((item) =>
          String(item.short_name).includes(provider),
        );
      }
      return {
        success: true,
        code: HttpStatus.OK,
        message: 'Plans successfully',
        data: plans,
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async findPlansForElectricityProvider(
    providerId: string,
  ): Promise<PagaMerchantPlanResponseDTO> {
    try {
      checkForRequiredFields(['providerId'], { providerId });
      const provider = await this.findProvider(providerId);
      const providerPlans = await this.findMerchantPlans(providerId);
      const providerName = provider.displayName.toLowerCase();
      const names = ['PREPAID', 'POSTPAID'];
      let plans = [];
      switch (providerName) {
        case 'aedc':
          const plan = providerPlans.data.find(
            (item) => item.shortCode === 'MY003',
          );
          plans = [{ ...plan, name: names[0] }];
          break;
        case 'eko electricity (ekedc)':
          const ekoPlans = providerPlans.data.filter(
            (item) => item.code !== 'ORDER_PAYMENT',
          );
          plans = ekoPlans;
          break;
        default:
          plans = providerPlans.data;
          break;
      }
      plans = plans.map((item) => ({
        ...item,
        name: item.name.toUpperCase(),
      }));
      return {
        success: true,
        code: HttpStatus.OK,
        message: 'Records found',
        data: plans,
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async findDataPlansForProvider(providerId: string): Promise<PagaDataPlanDTO> {
    try {
      const url = `${process.env.PAGA_BASE_URL}/getDataBundleByOperator`;
      const hashKey = ['referenceNumber', 'operatorPublicId'];
      const body = {
        referenceNumber: '11314250',
        operatorPublicId: providerId,
      };
      const { hash, password, username } = generatePagaHash(hashKey, body);
      const headers = {
        hash,
        principal: username,
        credentials: password,
        'Content-Type': 'application/json',
      };
      const response = await httpPost<any, any>(url, body, headers);
      if (response.responseCode !== 0) {
        throw new BadGatewayException(
          `Failed to get data plans for provider: ${providerId}`,
        );
      }
      return {
        success: true,
        code: HttpStatus.OK,
        message: 'Data-plans fetched successfully',
        data: response.mobileOperatorServices ?? [],
      };
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

  async findDataPlanById(
    providerId: string,
    dataPlanId: number,
  ): Promise<PagaDataPlanPartial> {
    try {
      const plans = await this.findDataPlansForProvider(providerId);
      const item = plans.data.find(({ serviceId }) => serviceId === dataPlanId);
      if (!item?.serviceId) {
        throw new NotFoundException(
          `Data plan with id: '${dataPlanId}' not found`,
        );
      }
      return item;
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async fundBettingWallet(
    payload: Partial<CreateBettingPurchaseDTO>,
    reference: string,
  ): Promise<FlutterwaveBillPaymentResponseDTO> {
    try {
      const url = `${process.env.PAGA_BASE_URL}/merchantPayment`;
      const body = {
        referenceNumber: reference,
        amount: String(payload.amount),
        currency: 'NGN',
        merchantAccount: payload.providerId,
        merchantReferenceNumber: payload.bettingWalletId,
        merchantService: [payload.merchantPlan],
      };
      const hashKey = [
        'referenceNumber',
        'amount',
        'merchantAccount',
        'merchantReferenceNumber',
      ];
      const { hash, password, username } = generatePagaHash(hashKey, body);
      const headers = {
        hash,
        principal: username,
        credentials: password,
        'Content-Type': 'application/json',
      };
      const response = await httpPost<any, any>(url, body, headers);
      console.log({ response });
      if (response.responseCode !== 0) {
        throw new BadGatewayException(
          response.message ?? `Failed to fund betting wallet`,
        );
      }
      return {
        success: true,
        code: HttpStatus.OK,
        message: response.message ?? 'Betting wallet funded successfully',
        data: {
          amount: payload.amount,
          flw_ref: response.transactionId,
          reference,
          network: payload.merchantPlan,
          phone_number: payload.bettingWalletId,
          tx_ref: reference,
        },
      };
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

  async makeElectricUnitPurchase(
    payload: CreateElectricityPurchaseDTO,
    reference: string,
    env = 'PROD',
  ): Promise<FlutterwaveBillPaymentResponseDTO> {
    try {
      if (env === 'TEST') {
        return {
          success: true,
          code: HttpStatus.OK,
          token: '08135290740392168110',
          message:
            'You have successfully paid N 1,000.00 to Abuja Electricity Distribution Company for acct 04279457719. Token: token: 08135290740392168110. Paga TxnID: 1CSBP',
          data: {
            amount: payload.amount,
            flw_ref: '1CSBP',
            reference,
            network: payload.merchantPlan,
            phone_number: payload.meterNumber,
            tx_ref: reference,
          },
        };
      }
      const url = `${process.env.PAGA_BASE_URL}/merchantPayment`;
      const body = {
        referenceNumber: reference,
        amount: payload.amount,
        currency: 'NGN',
        merchantAccount: payload.providerId,
        merchantReferenceNumber: payload.meterNumber,
        merchantService: [payload.merchantPlan],
      };
      const hashKey = [
        'referenceNumber',
        'amount',
        'merchantAccount',
        'merchantReferenceNumber',
      ];
      const { hash, password, username } = generatePagaHash(hashKey, body);
      const headers = {
        hash,
        principal: username,
        credentials: password,
        'Content-Type': 'application/json',
      };
      const response = await httpPost<any, any>(url, body, headers);
      if (response.responseCode !== 0) {
        throw new BadGatewayException(
          response.message ?? `Failed to make electricity unit purchase`,
        );
      }
      return {
        success: true,
        code: HttpStatus.OK,
        token: response.merchantTransactionReference,
        message: response.message ?? 'Unit purchase was successful',
        data: {
          amount: payload.amount,
          flw_ref: response.transactionId,
          reference,
          network: payload.merchantPlan,
          phone_number: payload.meterNumber,
          tx_ref: reference,
        },
      };
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

  async makeDataPurchase(
    payload: CreateFlutterwaveDataPurchaseDTO,
    reference: string,
    env = 'PROD',
  ): Promise<FlutterwaveBillPaymentResponseDTO> {
    try {
      if (env === 'TEST') {
        const response = {
          responseCode: 0,
          responseCategoryCode: null,
          message:
            'You successfully purchased N50.00 worth of data for phone number 08173749456.TRANSACTION Id: RDVZR.',
          referenceNumber: '00000000000025',
          transactionId: 'RDVZR',
          reversalId: null,
          currency: 'NGN',
          exchangeRate: null,
          integrationStatus: null,
          fee: null,
        };
        const transactionId = response.transactionId;
        return {
          success: true,
          code: HttpStatus.OK,
          message: response.message ?? 'Data-plans fetched successfully',
          token: transactionId,
          data: {
            amount: 0,
            flw_ref: response.referenceNumber,
            network: payload.operatorServiceId,
            phone_number: payload.phoneNumber,
            reference: response.referenceNumber,
            tx_ref: response.referenceNumber,
          },
        };
      }
      const url = `${process.env.PAGA_BASE_URL}/airtimePurchase`;
      const body = {
        referenceNumber: reference,
        amount: payload.amount,
        isDataBundle: true,
        destinationPhoneNumber: payload.phoneNumber,
        mobileOperatorServiceId: payload.operatorServiceId,
      };
      const hashKey = ['referenceNumber', 'amount', 'destinationPhoneNumber'];
      const { hash, password, username } = generatePagaHash(hashKey, body);
      const headers = {
        hash,
        principal: username,
        credentials: password,
        'Content-Type': 'application/json',
      };
      const response = await httpPost<any, any>(url, body, headers);
      if (response?.responseCode !== 0) {
        throw new BadGatewayException(
          response.message ??
            `Failed to get data plans for provider: ${payload.operatorServiceId}`,
        );
      }
      const transactionId = response.transactionId;
      return {
        success: true,
        code: HttpStatus.OK,
        message: response.message ?? 'Data-plans fetched successfully',
        token: transactionId,
        data: {
          amount: 0,
          flw_ref: response.referenceNumber,
          network: body.mobileOperatorServiceId,
          phone_number: payload.phoneNumber,
          reference: response.referenceNumber,
          tx_ref: response.referenceNumber,
        },
      };
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

  async findMerchantPlan(
    providerId: string,
    planCode: string,
  ): Promise<PagaMerchantPlanPartial> {
    try {
      const plans = await this.findMerchantPlans(providerId);
      const plan = plans.data.find(
        ({ name, shortCode }) => shortCode === planCode || name === planCode,
      );
      if (!plan) {
        throw new NotFoundException('Could not find plan');
      }
      return plan;
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async makeCablePlanPurchase(
    payload: CablePaymentRequestDTO,
    reference: string,
    plan: PagaMerchantPlanPartial,
  ): Promise<PagaCablePaymentResponseDTO> {
    try {
      checkForRequiredFields(
        ['providerId', 'decoderNumber', 'merchantServiceCode'],
        { ...payload, reference },
      );
      const url = `${process.env.PAGA_BASE_URL}/merchantPayment`;
      const hashKey = [
        'referenceNumber',
        'amount',
        'merchantAccount',
        'merchantReferenceNumber',
      ];
      const body = {
        referenceNumber: reference,
        amount: plan.price,
        currency: 'NGN',
        merchantAccount: payload.providerId,
        merchantReferenceNumber: payload.decoderNumber,
        merchantService: [payload.merchantServiceCode],
      };
      const { hash, password, username } = generatePagaHash(hashKey, body);
      const headers = {
        hash,
        principal: username,
        credentials: password,
        'Content-Type': 'application/json',
      };
      const response = await httpPost<any, any>(url, body, headers);
      if (response.responseCode !== 0) {
        throw new BadGatewayException(
          response.message ??
            `Failed to buy cable plan for customer: ${payload.merchantServiceCode}`,
        );
      }
      return {
        success: true,
        code: HttpStatus.OK,
        message: response.message ?? 'Cable-tv recharge successful',
        data: {
          decoderNumber: payload.decoderNumber,
          reference: response.referenceNumber,
          amount: String(plan.price),
          transactionId: response.transactionId,
        },
      };
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

  async makeAirtimePurchase(
    payload: CreateAirtimePurchaseDTO,
    reference: string,
    env = 'PROD',
  ): Promise<FlutterwaveBillPaymentResponseDTO> {
    try {
      checkForRequiredFields(
        ['amount', 'transactionPin', 'providerId', 'phoneNumber'],
        payload,
      );
      if (env === 'TEST') {
        const transactionId = '8W2B0';
        return {
          success: true,
          code: HttpStatus.OK,
          message: 'Airtime purchase successful',
          data: {
            phone_number: payload.phoneNumber,
            amount: payload.amount,
            network: payload.providerId,
            flw_ref: transactionId,
            tx_ref: transactionId,
            reference: transactionId,
          },
        };
      }
      const url = `${process.env.PAGA_BASE_URL}/airtimePurchase`;
      const body = {
        referenceNumber: reference,
        amount: payload.amount,
        isDataBundle: false,
        mobileOperatorPublicId: payload.providerId,
        destinationPhoneNumber: payload.phoneNumber,
      };
      const hashKey = ['referenceNumber', 'amount', 'destinationPhoneNumber'];
      const { hash, password, username } = generatePagaHash(hashKey, body);
      const headers = {
        hash,
        principal: username,
        credentials: password,
        'Content-Type': 'application/json',
      };
      const response = await httpPost<any, any>(url, body, headers);
      if (response.responseCode !== 0) {
        throw new BadGatewayException(
          response.message ?? 'Airtime purchase failed',
        );
      }
      const transactionId = response.transactionId;
      return {
        success: true,
        code: HttpStatus.OK,
        message: response.message ?? 'Airtime purchase successful',
        data: {
          phone_number: payload.phoneNumber,
          amount: payload.amount,
          network: payload.providerId,
          flw_ref: transactionId,
          tx_ref: transactionId,
          reference: transactionId,
        },
      };
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

  async findBettingProviders(): Promise<BillProviderDTO> {
    try {
      const values = await this.getMerchants();
      const searchValues = ['bet'];
      const excludeValues = [
        'travelbeta and tours limited',
        'better nature travel and tours',
        'grooming people for better lifehood',
      ];
      const bettingProviders: BillProviderPartial[] = values.data.filter(
        (item) => {
          const itemName = item.name.toLowerCase();
          if (
            searchValues.some((value) => itemName.includes(value.trim())) &&
            !excludeValues.some((value) => itemName.includes(value.trim()))
          ) {
            return item;
          }
        },
      );
      return {
        ...values,
        data: bettingProviders,
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async findCableProviders(): Promise<BillProviderDTO> {
    try {
      const values = await this.getMerchants();
      const searchValues = ['startimes', 'gotv', 'dstv'];
      const cableProviders: BillProviderPartial[] = values.data.filter(
        (item) => {
          const itemName = item.name.toLowerCase();
          if (searchValues.some((value) => itemName.includes(value))) {
            return item;
          }
        },
      );
      return {
        ...values,
        data: cableProviders,
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async findAirtimeProviders(searchTerm?: string): Promise<BillProviderDTO> {
    try {
      const url = `${process.env.PAGA_BASE_URL}/getMobileOperators`;
      const hashedKey = ['referenceNumber'];
      const requestBody = {
        referenceNumber: '11314250',
        locale: 'EN',
      };
      const { hash, username, password } = generatePagaHash(
        hashedKey,
        requestBody,
      );
      const headers = {
        hash,
        principal: username,
        credentials: password,
        'Content-Type': 'application/json',
      };
      const response = await httpPost<any, any>(url, requestBody, headers);
      let data = (response.mobileOperator as any[]).map(
        ({ name, mobileOperatorCode }) => ({
          name,
          code: mobileOperatorCode,
          displayName: name,
        }),
      );
      if (searchTerm) {
        data = data.filter((item) => item.name.includes(searchTerm));
      }
      return {
        success: true,
        code: HttpStatus.OK,
        message: 'Records found',
        data,
      };
    } catch (ex) {
      if (ex instanceof AxiosError) {
        const errorObject = ex.response?.data;
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

  private async findProvider(providerId: string): Promise<BillProviderPartial> {
    try {
      const providerData = await this.findElectricityProviders();
      const provider = providerData.data.find(
        (item) => item.code === providerId,
      );
      if (!provider) {
        throw new NotFoundException('Provider not found');
      }
      return provider;
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  private async getMerchants(): Promise<BillProviderDTO> {
    try {
      const url = `${process.env.PAGA_BASE_URL}/getMerchants`;
      const requestBody = {
        referenceNumber: '123457679',
        locale: 'EN',
      };
      const hashKeys = ['referenceNumber'];
      const { hash, username, password } = generatePagaHash(
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
      const data = (response.merchants as any[]).map(
        ({ name, displayName, uuid }) => ({
          name,
          code: uuid,
          displayName: displayName ?? name,
        }),
      );
      return {
        success: true,
        code: HttpStatus.OK,
        message: 'Records found',
        data,
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async findBettingMerchantPlans(
    merchantPublicId: string,
  ): Promise<PagaMerchantPlanResponseDTO> {
    try {
      const values = await this.findMerchantPlans(merchantPublicId);
      values.data = values.data.map((item) => ({
        ...item,
        shortCode: item.name,
      }));
      return values;
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async findMerchantPlans(
    merchantPublicId: string,
  ): Promise<PagaMerchantPlanResponseDTO> {
    try {
      checkForRequiredFields(['merchantPublicId'], { merchantPublicId });
      const url = `${process.env.PAGA_BASE_URL}/getMerchantServices`;
      const body = {
        referenceNumber: '123456',
        merchantPublicId,
        locale: 'EN',
      };
      const hashKey = ['referenceNumber', 'merchantPublicId'];
      const { hash, password, username } = generatePagaHash(hashKey, body);
      const headers = {
        hash,
        principal: username,
        credentials: password,
        'Content-Type': 'application/json',
      };
      const response = await httpPost<any, any>(url, body, headers);
      if (response.responseCode !== 0) {
        throw new BadGatewayException('Could not find merchant plans');
      }
      const services = (response.services as any[]).map((service) => {
        const shortCode =
          service.shortCode === '' || !service.shortCode
            ? service.code
            : service.shortCode;
        return {
          ...service,
          shortCode,
        };
      });
      return {
        success: true,
        code: HttpStatus.OK,
        message: 'Records found',
        data: services ?? [],
      };
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

  async findElectricityProviders(): Promise<BillProviderDTO> {
    try {
      const values = await this.getMerchants();
      const searchValues = ['electricity', 'enugu'];
      const electricityProviders: BillProviderPartial[] = values.data.filter(
        (item) => {
          const itemName = item.name.toLowerCase();
          const itemDisplayName = item.name.toLowerCase();
          if (
            searchValues.some(
              (value) =>
                itemName.includes(value) || itemDisplayName.includes(value),
            )
          ) {
            return item;
          }
        },
      );
      return {
        ...values,
        data: electricityProviders,
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async findInternetProviders(): Promise<BillProviderDTO> {
    return await this.findAirtimeProviders();
  }

  async verifyElectricityMeter(
    deviceNumber: string,
    providerId: string,
    planCode: string,
  ): Promise<PagaMeterDetailDTO> {
    try {
      const url = `${process.env.PAGA_BASE_URL}/getMerchantAccountDetails`;
      const reference = 'jone1571908284333';
      const hashKey = [
        'referenceNumber',
        'merchantAccount',
        'merchantReferenceNumber',
        'merchantServiceProductCode',
      ];
      const body = {
        referenceNumber: reference,
        merchantAccount: providerId,
        merchantReferenceNumber: deviceNumber,
        merchantServiceProductCode: planCode,
      };
      const { hash, password, username } = generatePagaHash(hashKey, body);
      const headers = {
        hash,
        principal: username,
        credentials: password,
        'Content-Type': 'application/json',
      };
      const response = await httpPost<any, any>(url, body, headers);
      if (response.responseCode !== 0) {
        throw new BadGatewayException('Could not find meter details');
      }
      return {
        deviceName: response.customerName,
        meterNumber: response.accountNumber,
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }
}
