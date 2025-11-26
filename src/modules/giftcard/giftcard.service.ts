import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { GiftCard, User } from '@entities/index';
import { GenericService } from '@schematics/index';
import {
  checkForRequiredFields,
  generateUniqueCode,
  PaymentStatus,
  sendEmail,
  TransactionType,
} from '@utils/index';
import { WalletService } from '@modules/wallet/wallet.service';
import { TransactionService } from '@modules/transaction/transaction.service';
import { BillService } from '@modules/bill/bill.service';
import { UserService } from '@modules/user/user.service';
import { CreateGiftCardProviderDTO, GiftCardDto, OrderDto } from './dto/giftcard-purchase.dto';
import axios from 'axios';


@Injectable()
export class GiftcardService extends GenericService(
  GiftCard,
) {
  constructor(
    private readonly userSrv: UserService,
    // private readonly billSrv: BillService,
    private readonly walletSrv: WalletService,
    private readonly transactionSrv: TransactionService,
  ) {
    super();
  }

  async getAccessToken(): Promise<{
    message: string;
    data?: any;
  }> {
    const isSandbox = process.env.ENVIRONMENT === 'sandbox';
    const clientId = isSandbox
      ? process.env.RELOADLY_TEST_CLIENT_ID
      : process.env.RELOADLY_CLIENT_ID;
    const clientSecret = isSandbox
      ? process.env.RELOADLY_TEST_CLIENT_SECRET
      : process.env.RELOADLY_CLIENT_SECRET;
    // console.log(isSandbox, clientId, clientSecret);
    if (!clientId || !clientSecret) {
      throw new Error('Reloadly client credentials not found in configuration');
    }

    const url = isSandbox
      ? 'https://auth.reloadly.com/oauth/token' // Sandbox endpoint
      : 'https://auth.reloadly.com/oauth/token'; // Replace with real endpoint

    const body = JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
      audience: isSandbox
        ? 'https://giftcards-sandbox.reloadly.com' // Sandbox audience
        : 'https://giftcards.reloadly.com', // Replace with real audience
    });

    try {
      const response = await axios.post(url, body, {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      });
      if (response.status !== 200) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data = response.data;
      // console.log(data)
      return {
        message: 'Access token retrieved successfully',
        data: data,
      };
    } catch (error) {
      console.error('Error fetching access token:', error);
      throw new Error('Error retrieving access token'); // Generic error for client
    }
  }


  async getGiftCardBalance(): Promise<any> {
    let url = '';
    if (process.env.ENVIRONMENT === 'sandbox') {
      url = 'https://giftcards-sandbox.reloadly.com/accounts/balance';
    } else if (process.env.ENVIRONMENT === 'production') {
      url = 'https://giftcards.reloadly.com/accounts/balance';
    } else {
      throw new Error('Invalid environment specified.');
    }

    const headers = {
      Accept: 'application/com.reloadly.giftcards-v1+json',
      Authorization: `Bearer ${(await this.getAccessToken()).data.access_token}`,
    };

    try {
      const response = await axios.get(url, { headers });
      const data = response.data;
      return {
        success: true,
        code: HttpStatus.OK,
        data: data.balance,
        message: 'Balance fetched successfully',
      };
    } catch (error) {
      console.error('Error fetching balance:', error);
      throw new Error('Failed to fetch balance from Reloadly.');
    }
  }
  async getCountries(): Promise<any> {
    let url = '';
    if (process.env.ENVIRONMENT === 'sandbox') {
      url = 'https://giftcards-sandbox.reloadly.com/countries';
    } else if (process.env.ENVIRONMENT === 'production') {
      url = 'https://giftcards.reloadly.com/countries';
    } else {
      throw new Error('Invalid environment specified.');
    }

    const headers = {
      Accept: 'application/com.reloadly.giftcards-v1+json',
      Authorization: `Bearer ${(await this.getAccessToken()).data.access_token}`,
    };

    try {
      const response = await axios.get(url, { headers });
      return {
        success: true,
        code: HttpStatus.OK,
        data: response.data,
        message: 'Countries fetched successfully',
      };
    } catch (error) {
      console.error('Error fetching countries:', error);
      throw new Error('Failed to fetch countries from Reloadly.');
    }
  }
  async getAllProductCategories(): Promise<any> {
    let url = '';
    if (process.env.ENVIRONMENT === 'sandbox') {
      url = 'https://giftcards-sandbox.reloadly.com/product-categories';
    } else if (process.env.ENVIRONMENT === 'production') {
      url = 'https://giftcards.reloadly.com/product-categories';
    } else {
      throw new Error('Invalid environment specified.');
    }

    const headers = {
      Accept: 'application/com.reloadly.giftcards-v1+json',
      Authorization: `Bearer ${(await this.getAccessToken()).data.access_token}`,
    };

    try {
      const response = await axios.get(url, { headers });
      return {
        success: true,
        code: HttpStatus.OK,
        data: response.data,
        message: 'Product categories fetched successfully',
      };
    } catch (error) {
      console.error('Error fetching product categories:', error);
      throw new Error('Failed to fetch product categories from Reloadly.');
    }
  }
  async getCountryProducts(countryCode: string): Promise<any> {
    let url = '';
    if (process.env.ENVIRONMENT === 'sandbox') {
      url = `https://giftcards-sandbox.reloadly.com/countries/${countryCode}/products`;
    } else if (process.env.ENVIRONMENT === 'production') {
      url = `https://giftcards.reloadly.com/countries/${countryCode}/products`;
    } else {
      throw new Error('Invalid environment specified.');
    }

    const headers = {
      Accept: 'application/com.reloadly.giftcards-v1+json',
      Authorization: `Bearer ${(await this.getAccessToken()).data.access_token}`,
    };

    try {
      const response = await axios.get(url, { headers });
      return {
        success: true,
        code: HttpStatus.OK,
        data: response.data,
        message: 'Country products fetched successfully',
      };
    } catch (error) {
      console.error('Error fetching country products:', error);
      throw new Error('Failed to fetch country products from Reloadly.');
    }
  }


  async searchProductsByName(
    wildcardName: string,
    countryCode: string,
  ): Promise<any> {
    console.log(wildcardName);
    let url = '';
    if (process.env.ENVIRONMENT === 'sandbox') {
      url = `https://giftcards-sandbox.reloadly.com/countries/${countryCode}/products`;
    } else if (process.env.ENVIRONMENT === 'production') {
      url = `https://giftcards.reloadly.com/countries/${countryCode}/products`;
    } else {
      throw new Error('Invalid environment specified.');
    }

    const headers = {
      Accept: 'application/com.reloadly.giftcards-v1+json',
      Authorization: `Bearer ${(await this.getAccessToken()).data.access_token}`,
    };

    try {
      const response = await axios.get(url, { headers });
      const giftcards: GiftCardDto[] = response.data.map(
        (item: any) => new GiftCardDto(),
      );

      // Filter giftcards based on the wildcardName
      const filteredGiftcards = response.data.filter(
        (giftcard) =>
          giftcard.productName
            .toLowerCase()
            .includes(wildcardName.toLowerCase()),
        // Add any other field filters here
      );

      // Format the response
      return {
        success: true,
        code: HttpStatus.OK,
        data: filteredGiftcards,
        message: 'Products filtered by name successfully',
      };
    } catch (error) {
      console.error('Error fetching country products:', error);
      throw new Error('Failed to fetch country products from Reloadly.');
    }
  }

  private validCategories = [
    { name: 'Finance' },
    { id: 2, name: 'Software' },
    { id: 3, name: 'Gaming' },
    { id: 4, name: 'Food and Entertainment' },
    { id: 5, name: 'Fashion and Retails' },
    { id: 6, name: 'Crypto' },
  ];

  async filterGiftcardsByCategory(categoryName: string, countryCode: string) {
    const validCategory = this.validCategories.find(
      (cat) => cat.name.toLowerCase() === categoryName.toLowerCase(),
    );

    if (!validCategory) {
      throw new Error('Invalid category name');
    }

    let url = '';
    if (process.env.ENVIRONMENT === 'sandbox') {
      url = `https://giftcards-sandbox.reloadly.com/countries/${countryCode}/products`;
    } else if (process.env.ENVIRONMENT === 'production') {
      url = `https://giftcards.reloadly.com/countries/${countryCode}/products`;
    } else {
      throw new Error('Invalid environment specified.');
    }

    const headers = {
      Accept: 'application/com.reloadly.giftcards-v1+json',
      Authorization: `Bearer ${(await this.getAccessToken()).data.access_token}`,
    };

    try {
      const response = await axios.get(url, { headers });
      const filteredGiftcards = response.data.filter(
        (giftcard) =>
          giftcard.category.name.toLowerCase() === categoryName.toLowerCase(),
      );

      // Format the response as specified
      return {
        success: true,
        code: HttpStatus.OK,
        data: filteredGiftcards,
        message: 'Giftcards filtered by category successfully',
      };
    } catch (error) {
      console.error('Error fetching country products:', error);
      throw new BadRequestException(
        'Failed to fetch country products from Reloadly.',
      );
    }
  }

  async getProductById(
    productId: number | string,
  ): Promise<{ success: boolean; code: any; data: any; message: string }> {
    let url = '';
    if (process.env.ENVIRONMENT === 'sandbox') {
      url = `https://giftcards-sandbox.reloadly.com/products/${productId}`;
    } else if (process.env.ENVIRONMENT === 'production') {
      url = `https://giftcards.reloadly.com/products/${productId}`;
    } else {
      throw new Error('Invalid environment specified.');
    }

    const headers = {
      Accept: 'application/com.reloadly.giftcards-v1+json',
      Authorization: `Bearer ${(await this.getAccessToken()).data.access_token}`,
    };

    try {
      const response = await axios.get(url, { headers });

      // Format the response as specified
      return {
        success: true,
        code: HttpStatus.OK,
        data: response.data,
        message: 'Product fetched successfully',
      };
    } catch (error) {
      console.error('Error fetching product:', error);
      throw new Error('Failed to fetch product from Reloadly.');
    }
  }

  async getFxRate(currencyCode: string, amount: number): Promise<any> {
    const url =
      process.env.ENVIRONMENT === 'sandbox'
        ? `https://giftcards-sandbox.reloadly.com/fx-rate?currencyCode=${currencyCode}&amount=${amount}`
        : `https://giftcards.reloadly.com/fx-rate?currencyCode=${currencyCode}&amount=${amount}`;

    const headers = {
      Accept: 'application/com.reloadly.giftcards-v1+json',
      Authorization: `Bearer ${(await this.getAccessToken()).data.access_token}`,
    };

    try {
      const response = await axios.get(url, { headers });

      // Format the response as specified
      return {
        success: true,
        code: HttpStatus.OK,
        data: response.data,
        message: 'FX rate fetched successfully',
      };
    } catch (error) {
      console.error('Error fetching FX rate:', error);
      throw new Error('Failed to fetch FX rate.');
    }
  }

  async placeOrder(orderDto: OrderDto): Promise<any> {
    orderDto.customIdentifier = Math.random().toString(36).substring(7); // Example random generation

    const url =
      process.env.ENVIRONMENT === 'sandbox'
        ? 'https://giftcards-sandbox.reloadly.com/orders'
        : 'https://giftcards.reloadly.com/orders';

    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/com.reloadly.giftcards-v1+json',
      Authorization: `Bearer ${(await this.getAccessToken()).data.access_token}`,
    };

    try {
      const response = await axios.post(url, orderDto, { headers });
      return { data: response.data, success: true };
    } catch (error) {
      console.error('Error placing order:', error);
      // throw new Error('Failed to place order.');
      throw new BadGatewayException(error.message);
    }
  }
  async createGiftCardPurchase(payload: CreateGiftCardProviderDTO): Promise<any> {
    console.log("Giftcard payload:",payload)
    try {
      checkForRequiredFields(
        ['productId', 'unitPrice', 'quantity', 'transactionPin', 'recipientEmail'],
        payload,
      );

      if (!payload.recipientEmail || !payload.senderName) {
        throw new BadGatewayException(`Invalid recipient email or name`);
      }

      await this.userSrv.verifyTransactionPin(payload.userid, payload.transactionPin);
      const plan = await this.getProductById(payload.productId);
      
      const convertedRate = await this.getFxRate(plan.data.recipientCurrencyCode, payload.unitPrice * payload.quantity);
      const RealNairaEquivalentOfCard = convertedRate.data.senderAmount;
      console.log("RealNairaEquivalentOfCard",RealNairaEquivalentOfCard)

      await this.userSrv.checkAccountBalance(RealNairaEquivalentOfCard, payload.userid);

      const userToUse = await this.userSrv.getRepo().findOne({ where: { id: payload.userid } });
      const narration = `Gift Card purchase (₦${RealNairaEquivalentOfCard}) for ${plan.data.productName}`;
      const transactionDate = new Date();
      const reference = `Spraay-Giftcard-${generateUniqueCode(10)}`;

      const GiftCardPurchase = await this.placeOrder({
        productId: payload.productId,
        quantity: payload.quantity,
        unitPrice: payload.unitPrice,
        senderName: payload.senderName,
        recipientEmail: payload.recipientEmail,
        preOrder: payload.preOrder,
        customIdentifier: payload.customIdentifier,
      });

      if (!GiftCardPurchase?.success) {
        throw new BadGatewayException('Gift Card purchase failed');
      }

      const newTransaction = await this.transactionSrv.createTransaction({
        narration,
        userId: userToUse.id,
        amount: RealNairaEquivalentOfCard,
        type: TransactionType.DEBIT,
        transactionStatus: PaymentStatus.SUCCESSFUL,
        reference,
        transactionDate:new Date().toLocaleString(),
        currentBalanceBeforeTransaction: userToUse.walletBalance,
      });

      const newGiftCard = await this.getRepo().create({
        transactionId: newTransaction.data.id,
        amount: RealNairaEquivalentOfCard,
        giftcardName: plan.data.productName,
        userId: payload.userid,
        createdDate: new Date(),
        createdTime: new Date(),
      });

      await this.getRepo().save(newGiftCard);

      return {
        success: true,
        code: HttpStatus.CREATED,
        data: newGiftCard,
        message: GiftCardPurchase.message,
      };
    } catch (ex) {
      console.error(ex);
      throw ex;
    }
  }

}
