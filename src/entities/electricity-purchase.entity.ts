import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, JoinColumn, ManyToOne, BeforeInsert } from 'typeorm';
import { ElectricityProvider, ElectricityPlan } from '@utils/index';
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

  @ApiProperty({ enum: ElectricityProvider })
  @Column({ enum: ElectricityProvider })
  provider: ElectricityProvider;

  @ApiProperty({ enum: ElectricityPlan })
  @Column({ enum: ElectricityProvider, default: ElectricityPlan.PRE_PAID })
  plan: ElectricityPlan;

  @BeforeInsert()
  beforeInsertHandler(): void {
    this.id = uuidV4();
  }
}
