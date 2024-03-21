import { Test, TestingModule } from '@nestjs/testing';
import { BettingPurchaseService } from './betting-purchase.service';

describe('BettingPurchaseService', () => {
  let service: BettingPurchaseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BettingPurchaseService],
    }).compile();

    service = module.get<BettingPurchaseService>(BettingPurchaseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
