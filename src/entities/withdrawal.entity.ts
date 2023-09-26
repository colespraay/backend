import { ApiProperty } from '@nestjs/swagger';
import { Entity, Column, BeforeInsert, JoinColumn, ManyToOne } from 'typeorm';
import { Base, Transaction, User, uuidV4 } from './index';

@Entity({ name: 'WITHDRAWAL' })
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

  @ApiProperty({ type: () => Transaction })
  @JoinColumn({ name: 'transactionId' })
  @ManyToOne(() => Transaction, ({ withdrawals }) => withdrawals, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  transaction: Transaction;

  @ApiProperty()
  @Column({ type: 'float', default: 0 })
  amount: number;

  @BeforeInsert()
  beforeInsertHandler(): void {
    this.id = uuidV4();
  }
}
