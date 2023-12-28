import { ApiProperty } from '@nestjs/swagger';
import { Entity, Column, BeforeInsert, JoinColumn, ManyToOne } from 'typeorm';
import { PaymentStatus } from '@utils/index';
import { Base, TransactionRecord, User, UserAccount, uuidV4 } from './index';

@Entity({ name: 'withdrawal' })
export class Withdrawal extends Base {
  @Column({ type: 'uuid' })
  userId: string;

  @ApiProperty({ nullable: true })
  @Column({ type: 'varchar', length:100, nullable: true })
  reference: string;

  @ApiProperty({ type: () => User })
  @JoinColumn({ name: 'userId' })
  @ManyToOne(() => User, ({ withdrawals }) => withdrawals, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  user: User;

  @ApiProperty()
  @Column({ type: 'bigint', default: 0 })
  transferId: number;

  @Column({ type: 'uuid', nullable: true })
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

  @Column({ type: 'uuid', nullable: true })
  userAccountId: string;

  @ApiProperty({ type: () => UserAccount })
  @JoinColumn({ name: 'userAccountId' })
  @ManyToOne(() => UserAccount, ({ withdrawals }) => withdrawals, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  userAccount: UserAccount;

  @ApiProperty({ enum: PaymentStatus })
  @Column({ enum: PaymentStatus, default: PaymentStatus.PENDING })
  paymentStatus: PaymentStatus;

  @BeforeInsert()
  beforeInsertHandler(): void {
    this.id = uuidV4();
  }
}
