import "reflect-metadata";
import path from "path";
import { fileURLToPath } from "url";
import { DataSource } from "typeorm";
import { repoRoot } from "./env.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type SupportedDbType = "mysql" | "sqlite";

/**
 * Normalizes DB type from env to a supported TypeORM driver.
 */
const normalizeDbType = (value: string | undefined): SupportedDbType => {
  const raw = (value ?? "mysql").trim().toLowerCase();
  return raw === "sqlite" ? "sqlite" : "mysql";
};

/**
 * Resolves a path that may be absolute or repo-root relative.
 */
const resolveRepoPath = (value: string) => {
  return path.isAbsolute(value) ? value : path.join(repoRoot, value);
};

/**
 * Reads a boolean env var.
 */
const readBool = (value: string | undefined, fallback: boolean) => {
  if (value == null) return fallback;
  return value.trim().toLowerCase() === "true";
};

/**
 * Builds TypeORM options for the selected database driver.
 */
const buildDatabaseOptions = (): DataSource["options"] => {
  const dbType = normalizeDbType(process.env.DB_TYPE);

  if (dbType === "sqlite") {
    const dbFile = resolveRepoPath(process.env.DB_SQLITE_PATH ?? "server/data/sqlite/mimi_chat.sqlite");

    return {
      type: "sqljs",
      location: dbFile,
      autoSave: true
    };
  }

  return {
    type: "mysql",
    host: process.env.DB_HOST ?? "localhost",
    port: Number(process.env.DB_PORT ?? 3306),
    username: process.env.DB_USER ?? "root",
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME ?? "mimi_chat"
  };
};

/**
 * Shared TypeORM data source for the API server.
 */
export const AppDataSource = new DataSource({
  ...buildDatabaseOptions(),
  entities: [path.join(__dirname, "models", "*.entity.{ts,js}")],
  synchronize: readBool(process.env.TYPEORM_SYNCHRONIZE, false),
  logging: readBool(process.env.TYPEORM_LOGGING, false)
});
