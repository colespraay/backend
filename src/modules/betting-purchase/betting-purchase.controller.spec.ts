import { Test, TestingModule } from '@nestjs/testing';
import { BettingPurchaseController } from './betting-purchase.controller';

describe('BettingPurchaseController', () => {
  let controller: BettingPurchaseController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BettingPurchaseController],
    }).compile();

    controller = module.get<BettingPurchaseController>(BettingPurchaseController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
