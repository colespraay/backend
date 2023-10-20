import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CablePurchaseService } from './cable-purchase.service';

@ApiTags('cable-provider')
@Controller('cable-provider')
export class CablePurchaseController {
  constructor(private readonly cablePurchaseSrv: CablePurchaseService) {}
}
