import { Test, TestingModule } from '@nestjs/testing';
import { AppProfitService } from './app-profit.service';

describe('AppProfitService', () => {
  let service: AppProfitService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AppProfitService],
    }).compile();

    service = module.get<AppProfitService>(AppProfitService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
