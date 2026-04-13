import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Canonical roles (spec §11). `userKind` on User stays the runtime guard source;
 * `roleId` links to this table for relational integrity.
 */
@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  key: string;
}
