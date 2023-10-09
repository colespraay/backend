import { ApiProperty } from '@nestjs/swagger';
import { Column, BeforeInsert, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { Base, EventRecord, TransactionRecord, User, uuidV4 } from './index';

@Entity({ name: 'event_spraay' })
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

  @Column({ type: 'uuid' })
  transactionId: string;

  @ApiProperty({ type: () => TransactionRecord })
  @JoinColumn({ name: 'transactionId' })
  @ManyToOne(() => TransactionRecord, ({ spraays }) => spraays, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  transaction: TransactionRecord;

  @BeforeInsert()
  beforeInsertHandler(): void {
    this.id = uuidV4();
  }
}
