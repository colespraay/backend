import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AirtimePurchaseService } from './airtime-purchase.service';

@ApiTags('airtime-purchase')
@Controller('airtime-purchase')
export class AirtimePurchaseController {
  constructor(private readonly airtimePurchaseSrv: AirtimePurchaseService) {}
}
