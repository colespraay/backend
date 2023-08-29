import { ApiProperty } from '@nestjs/swagger';
import { Column, BeforeInsert, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { Base, uuidV4, EventRecord, User } from './index';

@Entity({ name: 'EVENT_RSVP' })
export class EventRSVP extends Base {
  @Column({ type: 'uuid' })
  eventId: string;

  @ApiProperty({ type: () => EventRecord })
  @JoinColumn({ name: 'eventId' })
  @ManyToOne(() => EventRecord, ({ eventRsvps }) => eventRsvps, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  event: EventRecord;

  @Column({ type: 'uuid' })
  userId: string;

  @ApiProperty({ type: () => User })
  @JoinColumn({ name: 'userId' })
  @ManyToOne(() => User, ({ eventRsvps }) => eventRsvps, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  user: User;

  @BeforeInsert()
  beforeInsertHandler(): void {
    this.id = uuidV4();
  }
}
