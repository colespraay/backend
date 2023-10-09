import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, JoinColumn, ManyToOne, BeforeInsert } from 'typeorm';
import { User, Base, TransactionRecord, uuidV4 } from './index';

@Entity({ name: 'gifting' })
export class Gifting extends Base {
  @Column({ type: 'uuid' })
  receiverUserId: string;

  @ApiProperty({ type: () => User })
  @JoinColumn({ name: 'receiverUserId' })
  @ManyToOne(() => User, ({ gifts }) => gifts, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  receiverUser: User;

  @ApiProperty()
  @Column({ type: 'float', default: 0 })
  amount: number;

  @Column({ type: 'uuid' })
  transactionId: string;

  @ApiProperty({ type: () => TransactionRecord })
  @JoinColumn({ name: 'transactionId' })
  @ManyToOne(() => TransactionRecord, ({ gifts }) => gifts, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  transaction: TransactionRecord;

  @BeforeInsert()
  beforeInsertHandler(): void {
    this.id = uuidV4();
  }
}
