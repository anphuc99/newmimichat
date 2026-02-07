import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

/**
 * Persists chat messages used by the Home view.
 */
@Entity({ name: "messages" })
class MessageEntity {
  @PrimaryGeneratedColumn("increment")
  id!: number;

  @Column({ type: "varchar", length: 255 })
  content!: string;

  @CreateDateColumn({ name: "created_at", type: "timestamp" })
  createdAt!: Date;
}

export default MessageEntity;
