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
import ListeningCardEntity from "./listening-card.entity.js";

/**
 * Stores FSRS scheduling state for a listening card.
 */
@Entity({ name: "listening_reviews" })
class ListeningReviewEntity {
  @PrimaryGeneratedColumn("increment")
  id!: number;

  @Column({ name: "listening_card_id", type: "int" })
  listeningCardId!: number;

  @ManyToOne(() => ListeningCardEntity, { nullable: false, onDelete: "CASCADE" })
  @JoinColumn({ name: "listening_card_id" })
  listeningCard!: ListeningCardEntity;

  @Column({ name: "user_id", type: "int" })
  userId!: number;

  @ManyToOne(() => UserEntity, { nullable: false, onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: UserEntity;

  @Column({ type: "float", default: 0 })
  stability!: number;

  @Column({ type: "float", default: 5 })
  difficulty!: number;

  @Column({ type: "int", default: 0 })
  lapses!: number;

  @Column({ name: "current_interval_days", type: "int", default: 1 })
  currentIntervalDays!: number;

  @Column({ name: "next_review_date", type: "datetime" })
  nextReviewDate!: Date;

  @Column({ name: "last_review_date", type: "datetime", nullable: true })
  lastReviewDate!: Date | null;

  @Column({ name: "review_history", type: "text", default: "[]" })
  reviewHistoryJson!: string;

  @Column({ name: "is_starred", type: "boolean", default: false })
  isStarred!: boolean;

  @CreateDateColumn({ name: "created_at", type: "datetime" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "datetime" })
  updatedAt!: Date;
}

export default ListeningReviewEntity;
