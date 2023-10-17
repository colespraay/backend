import { BeforeInsert, Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { AirtimeProvider, formatPhoneNumberWithPrefix } from '@utils/index';
import { Base, User, uuidV4 } from './index';

@Entity({ name: 'data_purchase' })
export class DataPurchase extends Base {
  @Column({ type: 'uuid' })
  userId: string;

  @ApiProperty({ type: () => User })
  @JoinColumn({ name: 'userId' })
  @ManyToOne(() => User, ({ dataPurchases }) => dataPurchases, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  user: User;

  @ApiProperty()
  @Column({ type: 'int' })
  dataPlanId: number;

  @ApiProperty()
  @Column({ type: 'varchar', length: 20 })
  phoneNumber: string;

  @ApiProperty()
  @Column({ type: 'float' })
  amount: number;

  @Column({ enum: AirtimeProvider })
  provider: AirtimeProvider;

  @BeforeInsert()
  beforeInsertHandler(): void {
    this.id = uuidV4();
    this.phoneNumber = formatPhoneNumberWithPrefix(this.phoneNumber);
  }
}
