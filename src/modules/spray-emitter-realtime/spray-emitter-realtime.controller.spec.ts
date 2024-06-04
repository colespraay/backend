import { Test, TestingModule } from '@nestjs/testing';
import { SprayEmitterRealtimeController } from './spray-emitter-realtime.controller';

describe('SprayEmitterRealtimeController', () => {
  let controller: SprayEmitterRealtimeController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SprayEmitterRealtimeController],
    }).compile();

    controller = module.get<SprayEmitterRealtimeController>(SprayEmitterRealtimeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
