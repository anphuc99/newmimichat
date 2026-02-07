import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import UserEntity from "./user.entity.js";

/**
 * Persists summarized conversations (journals) for a user.
 */
@Entity({ name: "journals" })
class JournalEntity {
  @PrimaryGeneratedColumn("increment")
  id!: number;

  @Column({ type: "text" })
  summary!: string;

  @Column({ name: "user_id", type: "int" })
  userId!: number;

  @ManyToOne(() => UserEntity, { nullable: false, onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: UserEntity;

  @CreateDateColumn({ name: "created_at", type: "timestamp" })
  createdAt!: Date;
}

export default JournalEntity;
