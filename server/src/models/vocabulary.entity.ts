import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from "typeorm";
import UserEntity from "./user.entity.js";

/**
 * Persists collected vocabulary items for spaced repetition review.
 */
@Entity({ name: "vocabularies" })
class VocabularyEntity {
  @PrimaryGeneratedColumn("increment")
  id!: number;

  /** Korean word or phrase. */
  @Column({ type: "varchar", length: 255 })
  korean!: string;

  /** Vietnamese translation. */
  @Column({ type: "varchar", length: 255 })
  vietnamese!: string;

  /** Whether user added manually (not from chat). */
  @Column({ name: "is_manually_added", type: "boolean", default: false })
  isManuallyAdded!: boolean;

  @Column({ name: "user_id", type: "int" })
  userId!: number;

  @ManyToOne(() => UserEntity, { nullable: false, onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: UserEntity;

  @CreateDateColumn({ name: "created_at", type: "datetime" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "datetime" })
  updatedAt!: Date;
}

export default VocabularyEntity;
