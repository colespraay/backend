import { ApiProperty } from '@nestjs/swagger';
import {
  Entity,
  BeforeInsert,
  Column,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { Base, EventRecord, User, uuidV4 } from './index';

@Entity({ name: 'event_category' })
export class EventCategory extends Base {
  @ApiProperty()
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ApiProperty({ type: () => User })
  @JoinColumn({ name: 'userId' })
  @ManyToOne(
    () => User,
    ({ eventCategoriesCreated }) => eventCategoriesCreated,
    {
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
  )
  user: User;

  @ApiProperty({ type: () => [EventRecord] })
  @OneToMany(() => EventRecord, ({ eventCategory }) => eventCategory, {
    cascade: true,
  })
  events: EventRecord[];

  @BeforeInsert()
  beforeInsertHandler(): void {
    this.id = uuidV4();
    this.name = this.name.toUpperCase();
  }
}
