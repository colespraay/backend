import { ApiProperty } from '@nestjs/swagger';
import { Entity, Column, BeforeInsert, JoinColumn, ManyToOne } from 'typeorm';
import { Base, TransactionRecord, User, uuidV4 } from './index';

@Entity({ name: 'withdrawal' })
export class Withdrawal extends Base {
  @Column({ type: 'uuid' })
  userId: string;

  @ApiProperty({ type: () => User })
  @JoinColumn({ name: 'userId' })
  @ManyToOne(() => User, ({ withdrawals }) => withdrawals, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  user: User;

  @Column({ type: 'uuid' })
  transactionId: string;

  @ApiProperty({ type: () => TransactionRecord })
  @JoinColumn({ name: 'transactionId' })
  @ManyToOne(() => TransactionRecord, ({ withdrawals }) => withdrawals, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  transaction: TransactionRecord;

  @ApiProperty()
  @Column({ type: 'float', default: 0 })
  amount: number;

  @BeforeInsert()
  beforeInsertHandler(): void {
    this.id = uuidV4();
  }
}
