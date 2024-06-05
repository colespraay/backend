import { Module } from '@nestjs/common';
import { SprayEmitterRealtimeController } from './spray-emitter-realtime.controller';
import { SprayEmitterRealtimeGateway } from './spray-emitter-realtime.gateway';
import { EventModule } from '@modules/event/event.module';
import { UserModule } from '@modules/user/user.module';

@Module({
    imports: [ EventModule, UserModule],
  controllers: [SprayEmitterRealtimeController],
  providers: [SprayEmitterRealtimeGateway]
})
export class SprayEmitterRealtimeModule {}
