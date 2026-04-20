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

  /**
   * Optional branch coordinates. When both the branch and the customer's
   * shipping address expose lat/lng, the closest branch (haversine) wins the
   * tiebreaker after longest-prefix pin matching.
   */
  @Column('double precision', { nullable: true })
  latitude: number | null;

  @Column('double precision', { nullable: true })
  longitude: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
