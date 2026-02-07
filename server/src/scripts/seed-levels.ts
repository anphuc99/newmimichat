import "reflect-metadata";
import { AppDataSource } from "../data-source.js";
import LevelEntity from "../models/level.entity.js";

const DEFAULT_LEVELS: Array<Pick<LevelEntity, "level" | "maxWords" | "descript">> = [
  {
    level: "A0",
    maxWords: 3,
    descript: "Use only simple present tense. Avoid any complex grammar."
  },
  {
    level: "A1",
    maxWords: 5,
    descript: "Use simple sentences. Present tense and basic past. Allowed patterns: -고 싶다, -아/어요."
  },
  {
    level: "A2",
    maxWords: 7,
    descript: "Basic A2 compound structures are allowed: -고, -지만, -아서/-어서, -(으)면, -(으)려고. Avoid intermediate-level grammar."
  },
  {
    level: "B1",
    maxWords: 10,
    descript:
      "Use lower-intermediate (B1) grammar. Keep sentences not too long. Allowed patterns: -(으)ㄹ 수 있다, -아/어서, -(으)니까, -기 때문에, -(으)면, -는데, -(으)려고 하다, -(으)면서, -(으)ㄴ/는 것 같다, -아/어도 되다, -아/어야 하다. Avoid B2+ grammar."
  },
  {
    level: "B2",
    maxWords: 12,
    descript: "Use advanced grammar. Express opinions and more abstract ideas, but keep replies concise."
  },
  {
    level: "C1",
    maxWords: 15,
    descript: "Use advanced grammar, idiomatic expressions, and nuanced language while staying concise."
  },
  {
    level: "C2",
    maxWords: 20,
    descript: "Use natural, native-like language. Keep replies concise and helpful for learning."
  }
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
        continue;
      }

      const nextDescript = entry.descript.trim();
      const shouldUpdateDescript = existing.descript.trim() !== nextDescript;
      const shouldUpdateMaxWords = existing.maxWords !== entry.maxWords;

      if (shouldUpdateDescript || shouldUpdateMaxWords) {
        await repository.save({
          ...existing,
          descript: nextDescript,
          maxWords: entry.maxWords
        });
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
