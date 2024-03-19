import { ApiProperty } from '@nestjs/swagger';
import { BeforeInsert, Column, Entity } from 'typeorm';
import { Base, uuidV4 } from './index';

@Entity({ name: 'bank' })
export class Bank extends Base {
  @ApiProperty()
  @Column({ type: 'varchar', length: 50 })
  bankCode: string;

  @ApiProperty()
  @Column({ type: 'varchar', length: 255 })
  bankName: string;

  @ApiProperty()
  @Column({ type: 'varchar', length: 50, nullable: true })
  interInstitutionCode: string;

  @ApiProperty()
  @Column({ type: 'varchar', length: 50, nullable: true })
  sortCode: string;

  @BeforeInsert()
  beforeInsertHandler(): void {
    this.id = uuidV4();
    this.bankName?.toUpperCase();
  }
}
