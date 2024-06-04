import { EmmitEventSpraayDTO } from '@modules/event-spraay/dto/event-spraay.dto';
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

  @SubscribeMessage('sendSpray')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: EmmitEventSpraayDTO,
  ): Promise<void> {
    // Handle the incoming message and send it to the recipient
    const { receiver,sprayerId ,eventId} = payload;
    // const savedchat = await this.chatsService.sendChat(payload);
    // Send the message to the recipient's room
    this.server.to(eventId).emit('newSpary', payload);
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
