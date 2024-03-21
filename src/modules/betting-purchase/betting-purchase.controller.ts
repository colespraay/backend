import { Controller } from '@nestjs/common';
import { BettingPurchaseService } from './betting-purchase.service';

@Controller('betting-purchase')
export class BettingPurchaseController {
  constructor(private readonly bettingPurchaseSrv: BettingPurchaseService) {}
}
