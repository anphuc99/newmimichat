import cors from "cors";
import express from "express";

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

  app.get("/api/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  app.get("/api/message", (_request, response) => {
    response.json({
      message: "Hello from the Node.js server!",
      timestamp: new Date().toISOString()
    });
  });

  return app;
};

const app = createApp();
const port = Number(process.env.PORT ?? DEFAULT_PORT);

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
