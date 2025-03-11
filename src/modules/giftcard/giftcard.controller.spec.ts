import { Test, TestingModule } from '@nestjs/testing';
import { GiftcardController } from './giftcard.controller';

describe('GiftcardController', () => {
  let controller: GiftcardController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GiftcardController],
    }).compile();

    controller = module.get<GiftcardController>(GiftcardController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
