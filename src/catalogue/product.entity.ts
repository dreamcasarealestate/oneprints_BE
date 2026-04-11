import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ProductCategory } from './product-category.entity';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  sku: string;

  @Column()
  name: string;

  @Column({ type: 'uuid' })
  categoryId: string;

  @ManyToOne(() => ProductCategory, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'categoryId' })
  category: ProductCategory;

  @Column('text', { nullable: true })
  description: string | null;

  @Column('double precision')
  basePrice: number;

  /** [{ minQty, pricePerUnit }] */
  @Column('jsonb', { default: [] })
  bulkTiers: { minQty: number; pricePerUnit: number }[];

  @Column('jsonb', { default: [] })
  images: string[];

  /** [{ view, x, y, width, height }] */
  @Column('jsonb', { default: [] })
  printAreas: { view: string; x: number; y: number; width: number; height: number }[];

  @Column('jsonb', { default: [] })
  availableColours: string[];

  @Column('jsonb', { default: [] })
  availableSizes: string[];

  @Column({ default: 1 })
  minOrderQty: number;

  @Column({ default: 5 })
  productionTimeDays: number;

  @Column({ default: true })
  supportsEditor: boolean;

  @Column({ default: false })
  supportsCustomMeasurement: boolean;

  @Column({ default: true })
  supportsDesignerMarketplace: boolean;

  @Column('double precision', { default: 18 })
  gstRate: number;

  @Column({ default: true })
  isActive: boolean;

  /** null = all branches */
  @Column('jsonb', { nullable: true })
  branchAvailability: string[] | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
