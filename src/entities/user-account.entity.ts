import { ApiProperty } from '@nestjs/swagger';
import { BeforeInsert, Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { Base, User, Withdrawal, uuidV4 } from './index';

@Entity({ name: 'user_account' })
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

  @ApiProperty({ type: () => [Withdrawal] })
  @OneToMany(() => Withdrawal, ({ userAccount }) => userAccount, { cascade: true })
  withdrawals: Withdrawal[];

  @BeforeInsert()
  beforeInsertHandler(): void {
    this.id = uuidV4();
  }
}
