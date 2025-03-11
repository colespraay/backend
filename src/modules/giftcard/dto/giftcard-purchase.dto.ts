// order.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsInt,
  IsNumber,
  IsBoolean,
  IsEmail,
  IsPhoneNumber,
  IsNotEmptyObject,
} from 'class-validator';

export class OrderDto {
  @ApiProperty()
  @IsInt()
  productId: number;

  @ApiProperty()
  @IsInt()
  quantity: number;

  @ApiProperty()
  @IsNumber()
  unitPrice: number;

  @ApiProperty()
  @IsString()
  senderName: string;

  @ApiProperty()
  @IsEmail()
  recipientEmail: string;

  @ApiProperty()
  @IsBoolean()
  preOrder: boolean;

  @ApiProperty()
  customIdentifier: string; // Added manually
}

export class CreateGiftCardProviderDTO {

  @ApiProperty()
  @IsInt()
  productId: number;

  @ApiProperty()
  @IsInt()
  quantity: number;

  @ApiProperty()
  @IsNumber()
  unitPrice: number;

  @ApiProperty()
  @IsString()
  senderName: string;

  @ApiProperty()
  @IsEmail()
  recipientEmail: string;

  @ApiProperty()
  @IsBoolean()
  preOrder: boolean;

  @ApiProperty()
  customIdentifier: string; // Added manually

  @ApiProperty()
  transactionPin: string;

  @ApiProperty()
  userid: string;
}


class FixedRecipientToSenderDenominationsMap {
  [key: string]: number;
}

class Brand {
  @ApiProperty()
  brandId: number;

  @ApiProperty()
  brandName: string;
}

class Category {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;
}

class Country {
  @ApiProperty()
  isoName: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  flagUrl: string;
}

class RedeemInstruction {
  @ApiProperty()
  concise: string;

  @ApiProperty()
  verbose: string;
}

export class GiftCardDto {
  @ApiProperty()
  productId: number;

  @ApiProperty()
  productName: string;

  @ApiProperty()
  global: boolean;

  @ApiProperty()
  supportsPreOrder: boolean;

  @ApiProperty()
  senderFee: number;

  @ApiProperty()
  senderFeePercentage: number;

  @ApiProperty()
  discountPercentage: number;

  @ApiProperty()
  denominationType: string;

  @ApiProperty()
  recipientCurrencyCode: string;

  @ApiProperty({ nullable: true })
  minRecipientDenomination: number | null;

  @ApiProperty({ nullable: true })
  maxRecipientDenomination: number | null;

  @ApiProperty()
  senderCurrencyCode: string;

  @ApiProperty({ nullable: true })
  minSenderDenomination: number | null;

  @ApiProperty({ nullable: true })
  maxSenderDenomination: number | null;

  @ApiProperty({ type: [Number] })
  fixedRecipientDenominations: number[];

  @ApiProperty({ type: [Number] })
  fixedSenderDenominations: number[];

  @ApiProperty({ type: FixedRecipientToSenderDenominationsMap })
  fixedRecipientToSenderDenominationsMap: FixedRecipientToSenderDenominationsMap;

  @ApiProperty({ type: Object })
  metadata: Record<string, any>;

  @ApiProperty({ type: [String] })
  logoUrls: string[];

  @ApiProperty({ type: Brand })
  brand: Brand;

  @ApiProperty({ type: Category })
  category: Category;

  @ApiProperty({ type: Country })
  country: Country;

  @ApiProperty({ type: RedeemInstruction })
  redeemInstruction: RedeemInstruction;
}
export class CreateGiftCardDto {}
