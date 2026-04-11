import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../user/user.entity';

@Entity('corporate_accounts')
export class CorporateAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  userId: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  companyName: string;

  @Column({ nullable: true })
  gstNumber: string | null;

  @Column({ default: false })
  poCapability: boolean;

  @Column('double precision', { nullable: true })
  creditLimit: number | null;

  @Column({ type: 'uuid', nullable: true })
  accountManagerUserId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
