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

  /** Image URL lists per catalogue colour key (matches `availableColours` entries). Legacy rows may hold a single string per key — normalize on read/write. */
  @Column({ type: 'jsonb', nullable: true })
  imagesByColour: Record<string, string[]> | null;

  /** Blank / template images (no existing designs) for the canvas editor — products without colour variants. */
  @Column('jsonb', { default: [] })
  blankImages: string[];

  /** Blank / template image URLs per colour for the design editor canvas background. */
  @Column({ type: 'jsonb', nullable: true })
  blankImagesByColour: Record<string, string[]> | null;

  /** Category-specific custom sections and field groups shown in admin/storefront forms. */
  @Column('jsonb', { default: [] })
  customSections: Record<string, unknown>[];

  /** [{ view, x, y, width, height }] */
  @Column('jsonb', { default: [] })
  printAreas: { view: string; x: number; y: number; width: number; height: number }[];

  /** Which sides/views are printable, e.g. ["front","back"]. Default to ["front"]. */
  @Column('jsonb', { default: '["front"]' })
  printSides: string[];

  /** Per-side per-colour blank template images: { sideId: { colourKey: [urls] } }. */
  @Column({ type: 'jsonb', nullable: true })
  blankImagesBySideColour: Record<string, Record<string, string[]>> | null;

  /** Per-side per-colour storefront/display images: { sideId: { colourKey: [urls] } }. */
  @Column({ type: 'jsonb', nullable: true })
  imagesBySideColour: Record<string, Record<string, string[]>> | null;

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

  /** Search / merchandising tags (not product variants). */
  @Column('jsonb', { default: [] })
  tags: string[];

  /** When true, `stockQuantity` is shown and used for availability messaging. */
  @Column({ default: false })
  trackInventory: boolean;

  /** Units on hand when tracking; null = treat as unlimited / not set. */
  @Column('double precision', { nullable: true })
  stockQuantity: number | null;

  /** Optional note shown in admin / storefront (e.g. restock ETA). */
  @Column('text', { nullable: true })
  restockNote: string | null;

  /** Deprecated: catalogue is global; kept for DB compatibility, always null. */
  @Column('jsonb', { nullable: true })
  branchAvailability: string[] | null;

  @Column({ type: 'uuid', nullable: true })
  createdByUserId: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  createdByDisplayName: string | null;

  @Column({ type: 'uuid', nullable: true })
  updatedByUserId: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  updatedByDisplayName: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
