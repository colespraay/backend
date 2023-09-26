import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { Base, User } from './index';

@Entity({ name: 'USER_ACCOUNT' })
export class UserAccount extends Base {
  @ApiProperty()
  @Column({ type: 'varchar', length: 100 })
  bankName: string;

  @ApiProperty()
  @Column({ type: 'varchar', length: 100 })
  bankCode: string;

  @ApiProperty()
  @Column({ type: 'varchar', length: 50 })
  accountNumber: string;

  @ApiProperty()
  @Column({ type: 'varchar', length: 100 })
  accountName: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ApiProperty({ type: () => User })
  @JoinColumn({ name: 'userId' })
  @ManyToOne(() => User, ({ userAccounts }) => userAccounts, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  user: User;
}
