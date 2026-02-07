import "reflect-metadata";
import { DataSource } from "typeorm";
import { AppDataSource } from "../data-source.js";

/**
 * Initializes a data source with schema synchronization enabled for local setup.
 *
 * @returns An initialized TypeORM data source instance.
 */
const createSyncDataSource = async () => {
  const dataSource = new DataSource({
    ...AppDataSource.options,
    synchronize: true
  });

  await dataSource.initialize();
  return dataSource;
};

/**
 * Runs a one-time schema sync for local development.
 */
const run = async () => {
  let dataSource: DataSource | null = null;

  try {
    dataSource = await createSyncDataSource();
    console.log("Database schema synchronized successfully.");
  } catch (error) {
    console.error("Failed to synchronize database schema.", error);
    process.exitCode = 1;
  } finally {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  }
};

void run();
