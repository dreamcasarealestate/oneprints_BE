import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('branches')
export class Branch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  city: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  state: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  country: string | null;

  @Column('text', { nullable: true })
  address: string | null;

  @Column({ nullable: true })
  contactEmail: string | null;

  @Column({ nullable: true })
  contactPhone: string | null;

  @Column({ nullable: true })
  gstNumber: string | null;

  @Column({ default: true })
  isActive: boolean;

  /** Branch manager user id when assigned */
  @Column({ type: 'uuid', nullable: true })
  managerUserId: string | null;

  /** Match customer pin codes by prefix (e.g. "500", "560") */
  @Column('jsonb', { default: [] })
  pinCodePrefixes: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
