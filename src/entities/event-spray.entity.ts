import { ApiProperty } from '@nestjs/swagger';
import { Column, BeforeInsert, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { Base, EventRecord, User, uuidV4 } from './index';

@Entity({ name: 'EVENT_SPRAAY' })
export class EventSpraay extends Base {
  @Column({ type: 'uuid' })
  eventId: string;

  @ApiProperty({ type: () => EventRecord })
  @JoinColumn({ name: 'eventId' })
  @ManyToOne(() => EventRecord, ({ eventSpraays }) => eventSpraays, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  event: Event;

  @Column({ type: 'uuid' })
  userId: string;

  @ApiProperty({ type: () => User })
  @JoinColumn({ name: 'userId' })
  @ManyToOne(() => User, ({ eventSpraays }) => eventSpraays, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  user: User;

  @ApiProperty()
  @Column({ type: 'float', default: 0 })
  amount: number;

  @ApiProperty()
  @Column({ type: 'varchar', length: 255 })
  transactionReference: string;

  @BeforeInsert()
  beforeInsertHandler(): void {
    this.id = uuidV4();
  }
}
