import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import UserEntity from "./user.entity.js";

/**
 * Persists chat messages associated with a user.
 */
@Entity({ name: "messages" })
class MessageEntity {
  @PrimaryGeneratedColumn("increment")
  id!: number;

  @Column({ type: "varchar", length: 255 })
  content!: string;

  @Column({ type: "varchar", length: 16 })
  role!: "user" | "assistant";

  @Column({ name: "user_id", type: "int" })
  userId!: number;

  @ManyToOne(() => UserEntity, { nullable: false, onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: UserEntity;

  @CreateDateColumn({ name: "created_at", type: "timestamp" })
  createdAt!: Date;
}

export default MessageEntity;
