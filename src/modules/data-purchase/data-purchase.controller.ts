import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('data-purchase')
@Controller('data-purchase')
export class DataPurchaseController {}
