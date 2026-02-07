import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import JournalEntity from "./journal.entity.js";
import UserEntity from "./user.entity.js";

/**
 * Persists chat messages associated with a journal entry.
 */
@Entity({ name: "messages" })
class MessageEntity {
  @PrimaryGeneratedColumn("increment")
  id!: number;

  @Column({ type: "text" })
  content!: string;

  @Column({ name: "character_name", type: "varchar", length: 120 })
  characterName!: string;

  @Column({ name: "translation", type: "text", nullable: true })
  translation?: string | null;

  @Column({ name: "tone", type: "varchar", length: 120, nullable: true })
  tone?: string | null;

  @Column({ name: "audio", type: "varchar", length: 255, nullable: true })
  audio?: string | null;

  @Column({ name: "user_id", type: "int" })
  userId!: number;

  @Column({ name: "journal_id", type: "int" })
  journalId!: number;

  @ManyToOne(() => UserEntity, { nullable: false, onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: UserEntity;

  @ManyToOne(() => JournalEntity, { nullable: false, onDelete: "CASCADE" })
  @JoinColumn({ name: "journal_id" })
  journal!: JournalEntity;

  @CreateDateColumn({ name: "created_at", type: "timestamp" })
  createdAt!: Date;
}

export default MessageEntity;
