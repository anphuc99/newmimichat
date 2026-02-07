#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

/**
 * Converts a string to PascalCase.
 *
 * @param value - Raw input string.
 * @returns PascalCase value.
 */
const toPascalCase = (value) => {
  return value
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1).toLowerCase())
    .join("");
};

/**
 * Parses CLI arguments into an options object.
 *
 * @param argv - Raw CLI arguments.
 * @returns Parsed options.
 */
const parseArgs = (argv) => {
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--group") {
      options.group = argv[index + 1];
      index += 1;
    } else if (token === "--view") {
      options.view = argv[index + 1];
      index += 1;
    } else if (token === "--entity") {
      options.entity = argv[index + 1];
      index += 1;
    } else if (token === "--child") {
      options.child = argv[index + 1];
      index += 1;
    } else if (token === "--force") {
      options.force = true;
    }
  }

  return options;
};

/**
 * Ensures a directory exists.
 *
 * @param dirPath - Directory path to create.
 */
const ensureDir = (dirPath) => {
  fs.mkdirSync(dirPath, { recursive: true });
};

/**
 * Writes a file if it does not already exist unless forced.
 *
 * @param filePath - Target file path.
 * @param content - File content.
 * @param force - Whether to overwrite existing files.
 */
const writeFile = (filePath, content, force) => {
  if (!force && fs.existsSync(filePath)) {
    return;
  }

  fs.writeFileSync(filePath, content, "utf8");
};

/**
 * Inserts a line after a marker if the line does not already exist.
 *
 * @param source - File content.
 * @param marker - Marker string.
 * @param lineToInsert - Line to add.
 * @returns Updated file content.
 */
const insertAfterMarker = (source, marker, lineToInsert) => {
  if (source.includes(lineToInsert)) {
    return source;
  }

  const lines = source.split("\n");
  const markerIndex = lines.findIndex((line) => line.includes(marker));

  if (markerIndex === -1) {
    return source;
  }

  lines.splice(markerIndex + 1, 0, lineToInsert);

  return lines.join("\n");
};

/**
 * Updates the server routes index with new import and route registration.
 *
 * @param rootDir - Workspace root directory.
 * @param groupName - View group name.
 * @param pascalGroup - PascalCase group name.
 */
const updateRoutesIndex = (rootDir, groupName, pascalGroup) => {
  const routesIndexPath = path.join(rootDir, "server", "src", "routes", "index.ts");

  if (!fs.existsSync(routesIndexPath)) {
    return;
  }

  const importLine = `import { create${pascalGroup}Routes } from "./${groupName}.routes.js";`;
  const routeLine = `  router.use("/${groupName}", create${pascalGroup}Routes(dataSource));`;

  let source = fs.readFileSync(routesIndexPath, "utf8");
  source = insertAfterMarker(source, "mvc-gen:imports", importLine);
  source = insertAfterMarker(source, "mvc-gen:routes", routeLine);

  fs.writeFileSync(routesIndexPath, source, "utf8");
};

const options = parseArgs(process.argv.slice(2));

if (!options.group) {
  console.log("Usage: node Tool/mvc-gen.js --group <name> [--view <ViewName>] [--entity <EntityName>] [--child <ChildName>] [--force]");
  process.exit(1);
}

const groupName = options.group.toLowerCase();
const pascalGroup = toPascalCase(groupName);
const viewName = options.view ? toPascalCase(options.view) : `${pascalGroup}View`;
const childName = options.child ? toPascalCase(options.child) : `${pascalGroup}Panel`;
const entityName = options.entity ? toPascalCase(options.entity) : "Message";
const force = Boolean(options.force);
const rootDir = process.cwd();

const clientViewDir = path.join(rootDir, "client", "src", "views", groupName);
const clientComponentDir = path.join(clientViewDir, "components");
const serverControllerDir = path.join(rootDir, "server", "src", "controllers", groupName);
const serverRoutesDir = path.join(rootDir, "server", "src", "routes");
const serverModelsDir = path.join(rootDir, "server", "src", "models");
const testsControllerDir = path.join(rootDir, "tests", "server", "controllers", groupName);

ensureDir(clientComponentDir);
ensureDir(serverControllerDir);
ensureDir(serverRoutesDir);
ensureDir(serverModelsDir);
ensureDir(testsControllerDir);

const viewFilePath = path.join(clientViewDir, `${viewName}.tsx`);
const childFilePath = path.join(clientComponentDir, `${childName}.tsx`);
const indexFilePath = path.join(clientViewDir, "index.ts");
const controllerFilePath = path.join(serverControllerDir, `${groupName}.controller.ts`);
const routeFilePath = path.join(serverRoutesDir, `${groupName}.routes.ts`);
const modelFilePath = path.join(serverModelsDir, `${entityName.toLowerCase()}.entity.ts`);
const testFilePath = path.join(testsControllerDir, `${groupName}.controller.test.ts`);

const viewTemplate = `import { useEffect, useState } from "react";\nimport ${childName} from "./components/${childName}";\nimport { apiUrl } from "../../lib/api";\n\ninterface ApiMessage {\n  message: string;\n  timestamp: string;\n}\n\n/**\n * Renders the ${viewName} view.\n *\n * @returns The ${viewName} React component.\n */\nconst ${viewName} = () => {\n  const [apiMessage, setApiMessage] = useState<ApiMessage | null>(null);\n  const [error, setError] = useState<string | null>(null);\n\n  useEffect(() => {\n    let isMounted = true;\n\n    const loadMessage = async () => {\n      try {\n        const response = await fetch(apiUrl("/api/${groupName}/message"));\n\n        if (!response.ok) {\n          throw new Error("Failed to fetch message");\n        }\n\n        const data = (await response.json()) as ApiMessage;\n\n        if (isMounted) {\n          setApiMessage(data);\n        }\n      } catch (caught) {\n        if (isMounted) {\n          setError(caught instanceof Error ? caught.message : "Unknown error");\n        }\n      }\n    };\n\n    loadMessage();\n\n    return () => {\n      isMounted = false;\n    };\n  }, []);\n\n  return (\n    <main className=\"app\">\n      <header className=\"app__header\">\n        <h1>${pascalGroup}</h1>\n        <p>${viewName} view group</p>\n      </header>\n\n      <${childName} apiMessage={apiMessage} error={error} />\n    </main>\n  );\n};\n\nexport default ${viewName};\n`;

const childTemplate = `interface ApiMessage {\n  message: string;\n  timestamp: string;\n}\n\ninterface ${childName}Props {\n  apiMessage: ApiMessage | null;\n  error: string | null;\n}\n\n/**\n * Renders a child view for ${viewName}.\n *\n * @param props - Dependencies injected from ${viewName}.\n * @returns The ${childName} component.\n */\nconst ${childName} = ({ apiMessage, error }: ${childName}Props) => {\n  return (\n    <section className=\"card\">\n      <h2>API Message</h2>\n      {error ? (\n        <p className=\"text-error\">{error}</p>\n      ) : apiMessage ? (\n        <div>\n          <p>{apiMessage.message}</p>\n          <small>Received at {new Date(apiMessage.timestamp).toLocaleString()}</small>\n        </div>\n      ) : (\n        <p>Loading...</p>\n      )}\n    </section>\n  );\n};\n\nexport default ${childName};\n`;

const indexTemplate = `import ${viewName} from "./${viewName}";\n\nexport default ${viewName};\n`;

const controllerTemplate = `import type { Request, Response } from "express";\nimport type { DataSource } from "typeorm";\nimport ${entityName}Entity from "../../models/${entityName.toLowerCase()}.entity.js";\n\ninterface ${pascalGroup}Controller {\n  getMessage: (request: Request, response: Response) => Promise<void>;\n}\n\n/**\n * Builds the ${pascalGroup} controller with injected data source dependencies.\n *\n * @param dataSource - Initialized TypeORM data source.\n * @returns The ${pascalGroup} controller handlers.\n */\nexport const create${pascalGroup}Controller = (dataSource: DataSource): ${pascalGroup}Controller => {\n  const repository = dataSource.getRepository(${entityName}Entity);\n\n  const getMessage: ${pascalGroup}Controller[\"getMessage\"] = async (_request, response) => {\n    try {\n      const latestMessage = await repository.findOne({\n        order: {\n          createdAt: \"DESC\"\n        }\n      });\n\n      if (!latestMessage) {\n        response.json({\n          message: \"Hello from the Node.js server!\",\n          timestamp: new Date().toISOString()\n        });\n        return;\n      }\n\n      response.json({\n        message: latestMessage.content,\n        timestamp: latestMessage.createdAt.toISOString()\n      });\n    } catch (error) {\n      response.status(500).json({\n        message: \"Failed to load message\",\n        error: error instanceof Error ? error.message : \"Unknown error\"\n      });\n    }\n  };\n\n  return {\n    getMessage\n  };\n};\n`;

const routeTemplate = `import { Router } from \"express\";\nimport type { DataSource } from \"typeorm\";\nimport { create${pascalGroup}Controller } from \"../controllers/${groupName}/${groupName}.controller.js\";\n\n/**\n * Registers routes for the ${pascalGroup} view group.\n *\n * @param dataSource - Initialized TypeORM data source.\n * @returns An Express router for ${pascalGroup}.\n */\nexport const create${pascalGroup}Routes = (dataSource: DataSource) => {\n  const router = Router();\n  const controller = create${pascalGroup}Controller(dataSource);\n\n  router.get(\"/message\", controller.getMessage);\n\n  return router;\n};\n`;

const modelTemplate = `import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from \"typeorm\";\n\n/**\n * Persists ${pascalGroup} messages for the view group.\n */\n@Entity({ name: \"${groupName}_messages\" })\nclass ${entityName}Entity {\n  @PrimaryGeneratedColumn(\"increment\")\n  id!: number;\n\n  @Column({ type: \"varchar\", length: 255 })\n  content!: string;\n\n  @CreateDateColumn({ name: \"created_at\", type: \"timestamp\" })\n  createdAt!: Date;\n}\n\nexport default ${entityName}Entity;\n`;

const testTemplate = `import { describe, expect, it, vi } from \"vitest\";\nimport { create${pascalGroup}Controller } from \"../../../../server/src/controllers/${groupName}/${groupName}.controller\";\n\n/**\n * Creates a minimal Express-like response object for unit tests.\n *\n * @returns A mock response with json/status spies.\n */\nconst createMockResponse = () => {\n  const response = {};\n  response.json = vi.fn();\n  response.status = vi.fn(() => response);\n  return response;\n};\n\ndescribe(\"${pascalGroup} controller\", () => {\n  it(\"returns a fallback message when no message exists\", async () => {\n    const repository = {\n      findOne: vi.fn().mockResolvedValue(null)\n    };\n\n    const dataSource = {\n      getRepository: vi.fn(() => repository)\n    };\n\n    const controller = create${pascalGroup}Controller(dataSource);\n    const response = createMockResponse();\n\n    await controller.getMessage({}, response);\n\n    expect(repository.findOne).toHaveBeenCalledTimes(1);\n    expect(response.status).not.toHaveBeenCalled();\n    expect(response.json).toHaveBeenCalledTimes(1);\n  });\n});\n`;

writeFile(viewFilePath, viewTemplate, force);
writeFile(childFilePath, childTemplate, force);
writeFile(indexFilePath, indexTemplate, force);
writeFile(controllerFilePath, controllerTemplate, force);
writeFile(routeFilePath, routeTemplate, force);
writeFile(modelFilePath, modelTemplate, force);
writeFile(testFilePath, testTemplate, force);

updateRoutesIndex(rootDir, groupName, pascalGroup);

console.log(`MVC scaffolded for group: ${groupName}`);
