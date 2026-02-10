import cors from "cors";
import fs from "fs";
import path from "path";
import express from "express";
import { fileURLToPath } from "url";
import "./env.js";
import { AppDataSource } from "./data-source.js";
import { createApiRouter } from "./routes/index.js";

const DEFAULT_PORT = 4000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "..", "public");
const AUDIO_DIR = path.join(process.cwd(), "data", "audio");
const CLIENT_DIST_DIR = path.resolve(__dirname, "..", "..", "client", "dist");
const CLIENT_INDEX_HTML = path.join(CLIENT_DIST_DIR, "index.html");

/**
 * Creates the Express application instance with default middleware and routes.
 *
 * @returns Configured Express application.
 */
const createApp = () => {
  const app = express();

  app.use(cors());

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));

  app.use("/public", express.static(PUBLIC_DIR));
  app.use("/audio", express.static(AUDIO_DIR));

  app.use("/api", createApiRouter(AppDataSource));

  if (fs.existsSync(CLIENT_INDEX_HTML)) {
    app.use(express.static(CLIENT_DIST_DIR));
    app.get("*", (_req, res) => {
      res.sendFile(CLIENT_INDEX_HTML);
    });
  }

  return app;
};

/**
 * Initializes the data source and starts the server.
 */
const startServer = async () => {
  try {
    await AppDataSource.initialize();
    const app = createApp();
    const port = Number(process.env.PORT ?? DEFAULT_PORT);

    app.listen(port, () => {
      console.log(`Server listening on http://localhost:${port}`);
    });
  } catch (error) {
    console.error("Failed to initialize the data source.", error);
    process.exitCode = 1;
  }
};

void startServer();
