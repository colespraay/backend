import { ApiProperty } from '@nestjs/swagger';
import { Entity, Column, JoinColumn, ManyToOne, BeforeInsert } from 'typeorm';
import { Base, TransactionRecord, User, uuidV4 } from './index';

@Entity({ name: 'betting_purchase' })
export class BettingPurchase extends Base {
  @Column({ type: 'uuid' })
  userId: string;

  @ApiProperty({ type: () => User })
  @JoinColumn({ name: 'userId' })
  @ManyToOne(() => User, ({ bettingPurchases }) => bettingPurchases, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  user: User;

  @ApiProperty()
  @Column({ type: 'varchar', length: 20 })
  phoneNumber: string;

  @ApiProperty()
  @Column({ type: 'float', default: 0 })
  amount: number;

  @ApiProperty()
  @Column({ type: 'varchar', length: 255 })
  providerId: string;

  @ApiProperty()
  @Column({ type: 'varchar', length: 255 })
  bettingWalletId: string;

  @Column({ type: 'uuid', nullable: true })
  transactionId: string;

  @ApiProperty({ type: () => TransactionRecord })
  @JoinColumn({ name: 'transactionId' })
  @ManyToOne(
    () => TransactionRecord,
    ({ bettingPurchases }) => bettingPurchases,
    {
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
  )
  transaction: TransactionRecord;

  @BeforeInsert()
  beforeInsertHandler(): void {
    this.id = uuidV4();
  }
}
