import cors from "cors";
import express from "express";
import { AppDataSource } from "./data-source.js";
import { createApiRouter } from "./routes/index.js";

const DEFAULT_PORT = 4000;

/**
 * Creates the Express application instance with default middleware and routes.
 *
 * @returns Configured Express application.
 */
const createApp = () => {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use("/api", createApiRouter(AppDataSource));

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
