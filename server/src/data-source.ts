import "reflect-metadata";
import path from "path";
import { fileURLToPath } from "url";
import { DataSource } from "typeorm";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Shared TypeORM data source for the API server.
 */
export const AppDataSource = new DataSource({
  type: "mysql",
  host: process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT ?? 3306),
  username: process.env.DB_USER ?? "root",
  password: process.env.DB_PASSWORD ?? "",
  database: process.env.DB_NAME ?? "mimi_chat",
  entities: [path.join(__dirname, "models", "*.entity.{ts,js}")],
  synchronize: false,
  logging: false
});
