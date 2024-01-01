import { Test, TestingModule } from '@nestjs/testing';
import { AppProfitController } from './app-profit.controller';

describe('AppProfitController', () => {
  let controller: AppProfitController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppProfitController],
    }).compile();

    controller = module.get<AppProfitController>(AppProfitController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
