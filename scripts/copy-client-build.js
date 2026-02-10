import fs from "fs/promises";
import path from "path";

const ROOT_DIR = process.cwd();
const SOURCE_DIR = path.resolve(ROOT_DIR, "client", "dist");
const DEST_DIR = path.resolve(ROOT_DIR, "server", "client", "dist");

/**
 * Copies the built client assets into the server bundle for static hosting.
 *
 * @returns {Promise<void>} Resolves when the copy completes.
 */
const copyClientBuild = async () => {
  try {
    await fs.access(SOURCE_DIR);
  } catch {
    throw new Error(`Client build not found at ${SOURCE_DIR}. Run npm run build --workspace client first.`);
  }

  await fs.rm(DEST_DIR, { recursive: true, force: true });
  await fs.mkdir(DEST_DIR, { recursive: true });
  await fs.cp(SOURCE_DIR, DEST_DIR, { recursive: true });

  console.log(`Copied client build from ${SOURCE_DIR} to ${DEST_DIR}.`);
};

void copyClientBuild();
