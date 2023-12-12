import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('electricity-purchase')
@Controller('electricity-purchase')
export class ElectricityPurchaseController {}
