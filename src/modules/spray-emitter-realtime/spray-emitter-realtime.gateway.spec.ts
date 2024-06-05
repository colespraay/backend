import { Test, TestingModule } from '@nestjs/testing';
import { SprayEmitterRealtimeGateway } from './spray-emitter-realtime.gateway';

describe('SprayEmitterRealtimeGateway', () => {
  let gateway: SprayEmitterRealtimeGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SprayEmitterRealtimeGateway],
    }).compile();

    gateway = module.get<SprayEmitterRealtimeGateway>(SprayEmitterRealtimeGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });
});
