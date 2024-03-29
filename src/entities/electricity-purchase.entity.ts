import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, JoinColumn, ManyToOne, BeforeInsert } from 'typeorm';
import { Base, TransactionRecord, User, uuidV4 } from './index';

@Entity({ name: 'electricity_purchase' })
export class ElectricityPurchase extends Base {
  @ApiProperty()
  @Column({ type: 'varchar', length: 100 })
  unitToken: string;

  @ApiProperty()
  @Column({ type: 'varchar', length: 100 })
  meterNumber: string;

  @Column({ type: 'uuid' })
  transactionId: string;

  @ApiProperty({ type: () => TransactionRecord })
  @JoinColumn({ name: 'transactionId' })
  @ManyToOne(
    () => TransactionRecord,
    ({ electricityPurchases }) => electricityPurchases,
    {
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
  )
  transaction: TransactionRecord;

  @ApiProperty()
  @Column({ type: 'text', nullable: true })
  flutterwaveReference: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ApiProperty({ type: () => User })
  @JoinColumn({ name: 'userId' })
  @ManyToOne(() => User, ({ electricityPurchases }) => electricityPurchases, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  user: User;

  @ApiProperty()
  @Column({ type: 'float' })
  amount: number;

  @ApiProperty()
  @Column({ type: 'varchar', length: 255 })
  providerId: string;

  @ApiProperty()
  @Column({ type: 'varchar', length: 255 })
  plan: string;

  @BeforeInsert()
  beforeInsertHandler(): void {
    this.id = uuidV4();
  }
}
