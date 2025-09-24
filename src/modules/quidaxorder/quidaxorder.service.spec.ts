import { Test, TestingModule } from '@nestjs/testing';
import { QuidaxorderService } from './quidaxorder.service';

describe('QuidaxorderService', () => {
  let service: QuidaxorderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [QuidaxorderService],
    }).compile();

    service = module.get<QuidaxorderService>(QuidaxorderService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
