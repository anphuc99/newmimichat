import "reflect-metadata";
import { AppDataSource } from "../data-source.js";
import LevelEntity from "../models/level.entity.js";

const DEFAULT_LEVELS: Array<Pick<LevelEntity, "level" | "descript">> = [
  { level: "A0", descript: "Starting out: recognition of basic words and sounds." },
  { level: "A1", descript: "Basic phrases for familiar topics." },
  { level: "A2", descript: "Simple conversation and routine tasks." },
  { level: "B1", descript: "Handle everyday situations and short texts." },
  { level: "B2", descript: "Discuss abstract topics with some fluency." },
  { level: "C1", descript: "Understand complex texts and express ideas." },
  { level: "C2", descript: "Near-native understanding and expression." }
];

/**
 * Seeds the default CEFR levels into the database.
 */
const run = async () => {
  let dataSource;

  try {
    dataSource = await AppDataSource.initialize();
    const repository = dataSource.getRepository(LevelEntity);

    for (const entry of DEFAULT_LEVELS) {
      const existing = await repository.findOne({ where: { level: entry.level } });

      if (!existing) {
        await repository.save(repository.create(entry));
      }
    }

    console.log("Levels seeded successfully.");
  } catch (error) {
    console.error("Failed to seed levels.", error);
    process.exitCode = 1;
  } finally {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  }
};

void run();
