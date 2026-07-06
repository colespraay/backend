import { VirtualNumberStatus } from '@entities/virtual-number-order.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  IsPositive,
  IsUUID,
} from 'class-validator';


export class GetPriceDto {
  @ApiProperty({ description: 'Service code, e.g. wa, tg, fb', example: 'wa' })
  @IsString()
  service: string;

  @ApiPropertyOptional({
    description: 'GrizzlySMS country code. Omit or pass "any" to let the provider pick the best available country.',
    example: '74',
  })
  @IsOptional()
  @IsString()
  country?: string;
}

export class BuyVirtualNumberDto {
  @ApiProperty({ description: 'Service code, e.g. wa, tg, fb', example: 'wa' })
  @IsString()
  service: string;

  @ApiPropertyOptional({
    description: 'GrizzlySMS country code. Omit or pass "any" to let the provider pick the best available country.',
    example: '74',
  })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ description: 'Maximum price (USD) the user is willing to pay for the raw number, before markup' })
  @IsOptional()
  maxPrice?: number;

  @ApiProperty({ description: "User's transaction PIN, required to debit the wallet" })
  @IsString()
  transactionPin: string;

  @ApiProperty({ description: 'ID of the user making the purchase' })
  @IsUUID()
  userid: string;
}

export class ListOrdersDto {
  @ApiPropertyOptional({ enum: VirtualNumberStatus })
  @IsOptional()
  status?: VirtualNumberStatus;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @IsPositive()
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @IsInt()
  @IsPositive()
  limit?: number;
}

export class CancelOrderDto {
  @ApiProperty({ description: 'ID of the user cancelling the order' })
  @IsUUID()
  userid: string;
}