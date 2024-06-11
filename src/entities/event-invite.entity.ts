import { ApiProperty } from '@nestjs/swagger';
import { BeforeInsert, Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { Base, User, uuidV4, EventRecord } from './index';

@Entity({ name: 'event_invite' })
export class EventInvite extends Base {
  @Column({ type: 'uuid' })
  userId: string;

  @ApiProperty({ type: () => User })
  @JoinColumn({ name: 'userId' })
  @ManyToOne(() => User, ({ eventInvites }) => eventInvites, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  user: User;

  @Column({ type: 'uuid' })
  eventId: string;

  @Column({ type: 'text', default: "pending" })  // pending, accepted
  inviteStatus: string;

  @ApiProperty({ type: () => EventRecord })
  @JoinColumn({ name: 'eventId' })
  @ManyToOne(() => EventRecord, ({ eventInvites }) => eventInvites, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  event: EventRecord;

  @ApiProperty()
  @Column({ type: 'boolean', default: true })
  isInviteSent: boolean;

  @BeforeInsert()
  beforeInsertHandler(): void {
    this.id = uuidV4();
  }
}
