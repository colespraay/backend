import {
  BadRequestException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import {
  AirtimeProvider,
  CableProvider,
  ElectricityProvider,
  compareEnumValueFields,
  httpGet,
  httpPost,
} from '@utils/index';
import {
  CreateFlutterwaveCablePlanPurchaseDTO,
  CreateFlutterwaveDataPurchaseDTO,
} from '@modules/data-purchase/dto/data-purchase.dto';
import { CreateAirtimePurchaseDTO } from '@modules/airtime-purchase/dto/airtime-purchase.dto';
import {
  CreateElectricityPurchaseDTO,
  VerifyElectricityPurchaseDTO,
} from '@modules/electricity-purchase/dto/electricity-purchase.dto';
import {
  BillProviderDTO,
  FlutterwaveBillItemVerificationResponseDTO,
  FlutterwaveBillPaymentResponseDTO,
  FlutterwaveCableBillingOptionPartial,
  FlutterwaveCableBillingOptionResponseDTO,
  FlutterwaveDataPlanDTO,
  FlutterwaveDataPlanPartial,
} from './dto/bill.dto';

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
      console.log({ tifo: this.electricityProviders });
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
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

  async findDataPlansForProvider(
    provider?: AirtimeProvider,
  ): Promise<FlutterwaveDataPlanDTO> {
    try {
      if (provider) {
        compareEnumValueFields(
          provider,
          Object.values(AirtimeProvider),
          'provider',
        );
      }
      const url =
        'https://api.flutterwave.com/v3/bill-categories?data_bundle=1&country=NG';
      const plans = await httpGet<any>(url, {
        Authorization: `Bearer ${this.flutterwaveSecretKey}`,
      });
      let providerPlans: FlutterwaveDataPlanPartial[] = plans.data;
      if (provider) {
        providerPlans = plans.data.filter((item) =>
          String(item.name)?.toUpperCase().includes(provider),
        );
      }
      return {
        success: true,
        code: HttpStatus.OK,
        data: providerPlans,
        message: 'Records found',
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async findDataPlanById(
    dataPlanId: number,
  ): Promise<FlutterwaveDataPlanPartial> {
    try {
      const list = await this.findDataPlansForProvider();
      const item = list.data.find(({ id }) => id === dataPlanId);
      if (!item?.id) {
        throw new NotFoundException('Could not find data plan');
      }
      return item;
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async makeElectricUnitPurchase(
    payload: CreateElectricityPurchaseDTO,
    reference: string,
    env = 'TEST',
  ): Promise<FlutterwaveBillPaymentResponseDTO> {
    try {
      const url = 'https://api.flutterwave.com/v3/bills';
      const reqPayload = {
        country: 'NG',
        customer: payload.meterNumber,
        amount: payload.amount,
        recurrence: 'ONCE',
        type: payload.billerName,
        reference,
        biller_name: payload.billerName,
      };
      if (env === 'TEST') {
        return {
          success: true,
          code: HttpStatus.OK,
          message: 'Airtime purchase successful',
          data: {
            phone_number: payload.meterNumber,
            amount: payload.amount,
            network: payload.provider,
            flw_ref: reqPayload.reference,
            tx_ref: reqPayload.reference,
            reference: null,
          },
        };
      }
      const resp = await httpPost<any, any>(url, reqPayload, {
        Authorization: `Bearer ${this.flutterwaveSecretKey}`,
      });
      if (resp.status === 'success') {
        return {
          success: true,
          code: HttpStatus.OK,
          message: 'Electric unit purchase successful',
          data: resp.data,
        };
      }
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async makeDataPurchase(
    payload: CreateFlutterwaveDataPurchaseDTO,
    reference: string,
    env = 'TEST',
  ): Promise<FlutterwaveBillPaymentResponseDTO> {
    try {
      const url = 'https://api.flutterwave.com/v3/bills';
      const reqPayload = {
        country: 'NG',
        customer: payload.phoneNumber,
        amount: payload.amount,
        recurrence: 'ONCE',
        type: payload.type,
        reference: reference,
        biller_name: payload.provider,
      };
      if (env === 'TEST') {
        return {
          success: true,
          code: HttpStatus.OK,
          message: 'Airtime purchase successful',
          data: {
            phone_number: payload.phoneNumber,
            amount: payload.amount,
            network: payload.provider,
            flw_ref: reqPayload.reference,
            tx_ref: reqPayload.reference,
            reference: null,
          },
        };
      }
      const resp = await httpPost<any, any>(url, reqPayload, {
        Authorization: `Bearer ${this.flutterwaveSecretKey}`,
      });
      if (resp.status === 'success') {
        return {
          success: true,
          code: HttpStatus.OK,
          message: 'Dta purchase successful',
          data: resp.data,
        };
      }
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async makeCablePlanPurchase(
    payload: CreateFlutterwaveCablePlanPurchaseDTO,
    reference: string,
    plan: FlutterwaveCableBillingOptionPartial,
    env = 'TEST',
  ): Promise<FlutterwaveBillPaymentResponseDTO> {
    try {
      const url = 'https://api.flutterwave.com/v3/bills';
      const reqPayload = {
        country: 'NG',
        customer: payload.smartCardNumber,
        amount: payload.amount,
        recurrence: 'ONCE',
        type: plan.biller_name,
        reference: reference,
        biller_name: plan.biller_name,
      };
      if (env === 'TEST') {
        return {
          success: true,
          code: HttpStatus.OK,
          message: 'Airtime purchase successful',
          data: {
            phone_number: payload.smartCardNumber,
            amount: payload.amount,
            network: payload.provider,
            flw_ref: reqPayload.reference,
            tx_ref: reqPayload.reference,
            reference: null,
          },
        };
      }
      const resp = await httpPost<any, any>(url, reqPayload, {
        Authorization: `Bearer ${this.flutterwaveSecretKey}`,
      });
      if (resp.status === 'success') {
        return {
          success: true,
          code: HttpStatus.OK,
          message: 'Cable plan purchase successful',
          data: resp.data,
        };
      }
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async makeAirtimePurchase(
    payload: CreateAirtimePurchaseDTO,
    reference: string,
    env = 'TEST',
  ): Promise<FlutterwaveBillPaymentResponseDTO> {
    try {
      const url = 'https://api.flutterwave.com/v3/bills';
      const reqPayload = {
        country: 'NG',
        customer: payload.phoneNumber,
        amount: payload.amount,
        recurrence: 'ONCE',
        type: 'AIRTIME',
        reference: reference,
        biller_name: payload.provider,
      };
      if (env === 'TEST') {
        return {
          success: true,
          code: HttpStatus.OK,
          message: 'Airtime purchase successful',
          data: {
            phone_number: payload.phoneNumber,
            amount: payload.amount,
            network: payload.provider,
            flw_ref: reqPayload.reference,
            tx_ref: reqPayload.reference,
            reference: null,
          },
        };
      }
      const resp = await httpPost<any, any>(url, reqPayload, {
        Authorization: `Bearer ${this.flutterwaveSecretKey}`,
      });
      if (resp.status === 'success') {
        return {
          success: true,
          code: HttpStatus.OK,
          message: 'Airtime purchase successful',
          data: resp.data,
        };
      }
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async findCableProviders(): Promise<BillProviderDTO> {
    try {
      const url =
        'https://api.flutterwave.com/v3/bill-categories?cable=1&country=NG';
      const data = await httpGet<any>(url, {
        Authorization: `Bearer ${this.flutterwaveSecretKey}`,
      });
      const providers = data?.data.filter(
        ({ label_name }) => label_name === 'SmartCard Number',
      );
      return {
        success: true,
        code: HttpStatus.OK,
        message: 'Records found',
        data: [...new Set(providers.map(({ name }) => name))] as string[],
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async findAirtimeProviders(): Promise<BillProviderDTO> {
    try {
      const url =
        'https://api.flutterwave.com/v3/bill-categories?airtime=1&country=NG';
      const data = await httpGet<any>(url, {
        Authorization: `Bearer ${this.flutterwaveSecretKey}`,
      });
      const providers: any[] = [
        ...new Set(data?.data.map(({ name }) => name)),
      ].filter((item) => item !== 'AIRTIME');
      console;
      return {
        success: true,
        code: HttpStatus.OK,
        message: 'Records found',
        data: providers,
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async findElectricityProviders(): Promise<BillProviderDTO> {
    try {
      const url =
        'https://api.flutterwave.com/v3/bill-categories?power=1&country=NG';
      const data = await httpGet<any>(url, {
        Authorization: `Bearer ${this.flutterwaveSecretKey}`,
      });
      const providers = data?.data.map(({ name }) => name);
      return {
        success: true,
        code: HttpStatus.OK,
        message: 'Records found',
        data: [...new Set(providers)] as string[],
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async findInternetProviders(): Promise<BillProviderDTO> {
    try {
      const url =
        'https://api.flutterwave.com/v3/bill-categories?internet=1&country=NG';
      const data = await httpGet<any>(url, {
        Authorization: `Bearer ${this.flutterwaveSecretKey}`,
      });
      const providers = data?.data.map(({ name }) => name);
      return {
        success: true,
        code: HttpStatus.OK,
        message: 'Records found',
        data: [...new Set(providers)] as string[],
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  async verifyBillItem(
    itemCode: string,
    meterNumber: string,
    billerCode: string,
  ): Promise<FlutterwaveBillItemVerificationResponseDTO> {
    try {
      const headers = { Authorization: `Bearer ${this.flutterwaveSecretKey}` };
      const url = `https://api.flutterwave.com/v3/bill-items/${itemCode}/validate?customer=${meterNumber}&code=${billerCode}`;
      const verification = await httpGet<any>(url, headers);
      return {
        success: true,
        code: HttpStatus.OK,
        message: verification.message,
        data: { ...verification.data },
      };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }

  // Find all electricity provider
  // Use the plan to find which plan (Prepaid / postpaid)
  // If you cannot find prepaid plan, throw a 404 error
  async verifyElectricityPlan(
    payload: VerifyElectricityPurchaseDTO,
    env = 'TEST',
  ): Promise<FlutterwaveBillItemVerificationResponseDTO> {
    try {
      const headers = { Authorization: `Bearer ${this.flutterwaveSecretKey}` };
      const url =
        'https://api.flutterwave.com/v3/bill-categories?power=1&country=NG';
      const electricityProviders =
        this.electricityProviders ?? (await httpGet<any>(url, headers));
      if (electricityProviders.data?.length <= 0) {
        throw new NotFoundException('Could not verify provider');
      }
      let tag: string;
      if (payload.provider === ElectricityProvider.PHED) {
        tag = 'PORT HARCOURT';
      }
      switch (payload.provider) {
        case ElectricityProvider.PHED:
          tag = 'PORT HARCOURT';
          break;
        case ElectricityProvider.AEDC:
          tag = 'ABUJA';
          break;
        case ElectricityProvider.BEDC:
          tag = 'BENIN';
          break;
        case ElectricityProvider.EEDC:
          tag = 'ENUGU';
          break;
        case ElectricityProvider.IBEDC:
          tag = 'IBADAN';
          break;
        case ElectricityProvider.JEDC:
          tag = 'JOS';
          break;
        case ElectricityProvider.KAEDCO:
          tag = 'KADUNA';
          break;
        case ElectricityProvider.KEDCO:
          tag = 'KANO';
          break;
        case ElectricityProvider.EKEDC:
          tag = 'EKO';
          break;
        case ElectricityProvider.IKEDC:
          tag = 'IKEJA';
          break;
        default:
          throw new BadRequestException(
            `Could not find tag with provider: ${payload.provider}`,
          );
          break;
      }
      const selectedOne = electricityProviders.data.find((item) => {
        const name = String(item.name)?.toUpperCase();
        const shortName = String(item.short_name)?.toUpperCase();
        const billerName = String(item.biller_name)?.toUpperCase();
        return (
          (shortName.includes(tag) ||
            billerName.includes(tag) ||
            name.includes(tag)) &&
          billerName.includes(payload.plan)
        );
      });
      this.logger.log({ selectedOne });
      if (!selectedOne) {
        throw new NotFoundException(
          `We do not yet offer this service for '${payload.provider}'`,
        );
      }
      if (env === 'TEST') {
        return {
          success: true,
          code: HttpStatus.OK,
          message: 'Item verified successfully',
          selectedOne,
          data: {
            response_code: '00',
            address: null,
            response_message: 'Successful',
            name: ElectricityProvider.EEDC,
            biller_code: 'BIL099',
            customer: '08109328188',
            product_code: 'AT099',
            email: null,
            fee: 0,
            maximum: 0,
            minimum: 0,
          },
        };
      }
      // Verify the meter number
      const verification = await this.verifyBillItem(
        selectedOne.item_code,
        payload.meterNumber,
        selectedOne.biller_code,
      );
      this.logger.log({ verification });
      return { ...verification, selectedOne };
    } catch (ex) {
      this.logger.error(ex);
      throw ex;
    }
  }
}
