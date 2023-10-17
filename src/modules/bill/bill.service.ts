import {
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AirtimeProvider,
  compareEnumValueFields,
  httpGet,
  httpPost,
} from '@utils/index';
import { CreateFlutterwaveDataPurchaseDTO } from '@modules/data-purchase/dto/data-purchase.dto';
import { CreateAirtimePurchaseDTO } from '@modules/airtime-purchase/dto/airtime-purchase.dto';
import {
  BillProviderDTO,
  FlutterwaveBillPaymentResponseDTO,
  FlutterwaveDataPlanDTO,
  FlutterwaveDataPlanPartial,
} from './dto/bill.dto';

@Injectable()
export class BillService {
  private readonly logger = new Logger(BillService.name);
  private readonly flutterwaveSecretKey = String(
    process.env.FLUTTERWAVE_SECRET_KEY,
  );

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
            amount: 500,
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
          message: 'Data purchase successful',
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
            amount: 500,
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
      const url = 'https://api.flutterwave.com/v3/bill-categories?cables=1';
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
}
