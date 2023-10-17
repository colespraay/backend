import { ApiProperty } from '@nestjs/swagger';
import { Entity, Column, JoinColumn, ManyToOne, BeforeInsert } from 'typeorm';
import { AirtimeProvider, formatPhoneNumberWithPrefix } from '@utils/index';
import { Base, User, uuidV4 } from './index';

@Entity({ name: 'airtime_purchase' })
export class AirtimePurchase extends Base {
  @Column({ type: 'uuid' })
  userId: string;

  @ApiProperty({ type: () => User })
  @JoinColumn({ name: 'userId' })
  @ManyToOne(() => User, ({ airtimePurchases }) => airtimePurchases, {
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

  @Column({ enum: AirtimeProvider })
  provider: AirtimeProvider;

  @BeforeInsert()
  beforeInsertHandler(): void {
    this.id = uuidV4();
    this.phoneNumber = formatPhoneNumberWithPrefix(this.phoneNumber);
  }
}
