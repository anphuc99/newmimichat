import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

/**
 * Persists character profiles for the Characters view group.
 */
@Entity({ name: "characters" })
class CharacterEntity {
  @PrimaryGeneratedColumn("increment")
  id!: number;

  @Column({ type: "varchar", length: 120 })
  name!: string;

  @Column({ type: "text" })
  personality!: string;

  @Column({ type: "varchar", length: 12 })
  gender!: "male" | "female";

  @Column({ type: "text", nullable: true })
  appearance?: string | null;

  @Column({ type: "varchar", length: 512, nullable: true })
  avatar?: string | null;

  @Column({ type: "varchar", length: 32, nullable: true })
  voiceModel?: string | null;

  @Column({ type: "varchar", length: 64, nullable: true })
  voiceName?: string | null;

  @Column({ type: "float", nullable: true })
  pitch?: number | null;

  @Column({ type: "float", nullable: true })
  speakingRate?: number | null;

  @CreateDateColumn({ name: "created_at", type: "timestamp" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamp" })
  updatedAt!: Date;
}

export default CharacterEntity;
