import { ApiProperty } from '@nestjs/swagger';
import { BeforeInsert, Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { Base, User, uuidV4, EventRecord } from './index';

@Entity({ name: 'EVENT_INVITE' })
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

  @ApiProperty({ type: () => EventRecord })
  @JoinColumn({ name: 'eventId' })
  @ManyToOne(() => EventRecord, ({ eventInvites }) => eventInvites, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  event: Event;

  @ApiProperty()
  @Column({ type: 'boolean', default: false })
  isInviteSent: boolean;

  @BeforeInsert()
  beforeInsertHandler(): void {
    this.id = uuidV4();
  }
}
