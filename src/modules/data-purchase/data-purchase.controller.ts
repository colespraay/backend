import { Body, Controller, HttpException, HttpStatus, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DataPurchaseService } from './data-purchase.service';
import { CreateDataPurchaseDtoDemo } from './dto/data-purchase.dto';
import { DataPurchase } from '@entities/data-purchase.entity';
import { formatPhoneNumberWithPrefix } from '@utils/utils.function';

@ApiTags('data-purchase')
@Controller('data-purchase')
export class DataPurchaseController {
    constructor(private readonly dataPurchaseService: DataPurchaseService) {}

  @Post()
  @ApiBody({ type: CreateDataPurchaseDtoDemo })
  @ApiOperation({ summary: 'Create a new data purchase' })
  @ApiResponse({ status: 201, type: DataPurchase, description: 'Created DataPurchase' })
  @ApiResponse({ status: 400, description: 'Bad request (validation error)' })
  async createDataPurchase(
    @Body() createDataPurchaseDto: CreateDataPurchaseDtoDemo,
  ): Promise<DataPurchase> {
    try {
      const formattedPhoneNumber = formatPhoneNumberWithPrefix(createDataPurchaseDto.phoneNumber);
      const dataPurchase = await this.dataPurchaseService.createDataPurchaseDemo(
        createDataPurchaseDto.userId,
        createDataPurchaseDto.dataPlanId,
        formattedPhoneNumber,
        createDataPurchaseDto.amount,
        createDataPurchaseDto.providerId,
      );
      return dataPurchase;
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }
}
