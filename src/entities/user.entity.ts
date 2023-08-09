import { ApiProperty } from '@nestjs/swagger';
import {
  DefaultPassportLink,
  AppRole,
  AuthProvider,
  hashPassword,
} from '@utils/index';
import { Entity, Column, BeforeInsert, OneToMany } from 'typeorm';
import { Base, uuidV4 } from './index';

@Entity({ name: 'USER' })
export class User extends Base {
  @ApiProperty()
  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @ApiProperty()
  @Column({ type: 'varchar', length: 255, unique: true })
  phoneNumber: string;

  @ApiProperty()
  @Column({ type: 'varchar', length: 255 })
  firstName: string;

  @ApiProperty()
  @Column({ type: 'varchar', length: 255 })
  lastName: string;

  @ApiProperty()
  @Column({ type: 'varchar', length: 255 })
  password: string;

  @ApiProperty()
  @Column({ type: 'varchar', length: 10, nullable: true })
  uniqueVerificationCode: string;

  @ApiProperty()
  @Column({ type: 'boolean', default: false })
  isNewUser: boolean;

  @ApiProperty({ enum: AppRole })
  @Column({ enum: AppRole, default: AppRole.CUSTOMER })
  role: AppRole;

  @ApiProperty({ enum: AuthProvider })
  @Column({ enum: AuthProvider, default: AuthProvider.LOCAL })
  authProvider: AuthProvider;

  @ApiProperty()
  @Column({ type: 'text', default: DefaultPassportLink.male })
  profileImageUrl: string;

  @BeforeInsert()
  async beforeInsertHandler(): Promise<void> {
    this.id = uuidV4();
    this.email = this.email?.toUpperCase();
    const setPassword = this.password ?? '12345';
    this.password = await hashPassword(setPassword);
  }
}
