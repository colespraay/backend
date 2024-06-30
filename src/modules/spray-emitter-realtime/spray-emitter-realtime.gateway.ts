import { EmmitEventSpraayDTO, EmmitEventSpraayDTOReal } from '@modules/event-spraay/dto/event-spraay.dto';
import { EventService } from '@modules/event/event.service';
import { UserService } from '@modules/user/user.service';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class SprayEmitterRealtimeGateway implements OnGatewayConnection {
  constructor(
    private readonly eventSrv: EventService,
    private readonly userSrv: UserService,
    ////import event sparayy for getting all spray for a user
  ) {}
  @WebSocketServer()
  server: Server;

  handleConnection(@ConnectedSocket() client: Socket): void {
    // Handle client connection
    const userId = client.handshake.query.userId;
    client.join(userId);
  }

  async generateSprayId(length) {
    const characters = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
  }

  @SubscribeMessage('sendSpray')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: EmmitEventSpraayDTOReal,
  ): Promise<void> {
    const { receiver,sprayerId ,eventId} = payload;
    const characters = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < 7; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    const sprayId = result
    console.log({...payload,autoId: sprayId})
    // const PayloadToSendsend= {...payload,autoId: sprayId}
    // this.server.to(eventId).emit('newSpary', PayloadToSendsend);
    
    const payloadToSend = { ...payload }; // Create a copy of the payload

    if (
      //typeof payloadToSend.amount === 'number' &&
      payloadToSend.amount.toString().endsWith('.0')
    ) {
      payloadToSend.amount = Math.floor(payloadToSend.amount); 
    }

    payloadToSend.autoId = sprayId; // Add the autoId property
    this.server.to(eventId).emit('newSpary', payloadToSend);
  }

  // @SubscribeMessage('findAllMessage')
  // async findallMessage(@MessageBody() payload: GetChatsDto): Promise<any> {
  //   const allChats = this.chatsService.getConversation(payload);
  //   return allChats;
  // }

  // @SubscribeMessage('sendNotification')
  // async handlenotification(
  //   @ConnectedSocket() client: Socket,
  //   @MessageBody() payload: CreateNotificationDto,
  // ): Promise<void> {
  //   // Handle the incoming message and send it to the recipient
  //   const { userid, content } = payload;
  //   const savedchat = await this.chatsService.createNotification(payload);
  //   // Send the message to the recipient's room
  //   this.server.to(payload.userid).emit('newNotification', payload);
  // }
  // @SubscribeMessage('markNotificationAsRead')
  // async marknotification(
  //   @ConnectedSocket() client: Socket,
  //   @MessageBody() payload: { notificationid: string },
  // ): Promise<void> {
  //   // Handle the incoming message and send it to the recipient
  //   const { notificationid } = payload;
  //   const savedchat = await this.chatsService.markNotificationAsRead(
  //     notificationid,
  //   );
  //   // Send the message to the recipient's room
  //   // this.server.to(payload.userid).emit('newNotification', payload);
  // }

  // @SubscribeMessage('findAllNotification')
  // async findallNotification(
  //   @MessageBody() payload: { userId: string; skip: number; limit: number },
  // ): Promise<any> {
  //   const allChats = this.chatsService.findNotificationsByUserId(
  //     payload.userId,
  //     payload.skip,
  //     payload.limit,
  //   );
  //   return allChats;
  // }

}
