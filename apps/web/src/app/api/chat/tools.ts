import { tool } from "ai";
import { z } from "zod";

const SANDBOX_SERVICE_URL = process.env.API_URL ?? "http://localhost:4000";

async function callSidecar(endpoint: string, body: Record<string, unknown>): Promise<unknown> {
  console.log(`[sandbox] POST ${endpoint}`, JSON.stringify(body));
  const res = await fetch(`${SANDBOX_SERVICE_URL}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text();
    console.error(`[sandbox] ${endpoint} FAILED (${res.status}):`, detail);
    throw new Error(`Sidecar ${endpoint} failed (${res.status}): ${detail}`);
  }
  const json = await res.json();
  console.log(`[sandbox] ${endpoint} OK:`, JSON.stringify(json));
  return json;
}

export const sandboxTools = {
  createSandbox: tool({
    description:
      "Create a new Modal sandbox environment with Node.js 20. Call this first before writing files or running commands.",
    inputSchema: z.object({
      sandboxId: z.string().describe("Unique identifier for the sandbox, typically the project ID"),
    }),
    execute: async ({ sandboxId }) => {
      console.log(`[tool] createSandbox sandboxId=${sandboxId}`);
      try {
        const result = await callSidecar("/sandbox/create", { sandbox_id: sandboxId });
        console.log(`[tool] createSandbox done`);
        return result;
      } catch (err) {
        console.error(`[tool] createSandbox error:`, err);
        throw err;
      }
    },
  }),

  writeFile: tool({
    description: "Write a single file to the sandbox filesystem.",
    inputSchema: z.object({
      sandboxId: z.string().describe("The sandbox identifier"),
      filePath: z.string().describe("Absolute path within the sandbox (e.g. /app/package.json)"),
      content: z.string().describe("The full file content to write"),
    }),
    execute: async ({ sandboxId, filePath, content }) => {
      console.log(
        `[tool] writeFile sandboxId=${sandboxId} path=${filePath} (${content.length} chars)`
      );
      try {
        const result = await callSidecar("/sandbox/write-files", {
          sandbox_id: sandboxId,
          files: { [filePath]: content },
        });
        console.log(`[tool] writeFile done`);
        return result;
      } catch (err) {
        console.error(`[tool] writeFile error:`, err);
        throw err;
      }
    },
  }),

  writeFiles: tool({
    description:
      "Batch write multiple files to the sandbox filesystem. Prefer this over writeFile when creating multiple files.",
    inputSchema: z.object({
      sandboxId: z.string().describe("The sandbox identifier"),
      files: z
        .record(z.string(), z.string())
        .describe("Object mapping file paths to contents, e.g. { '/app/package.json': '...' }"),
    }),
    execute: async ({ sandboxId, files }) => {
      const paths = Object.keys(files);
      console.log(`[tool] writeFiles sandboxId=${sandboxId} files=[${paths.join(", ")}]`);
      try {
        const result = await callSidecar("/sandbox/write-files", {
          sandbox_id: sandboxId,
          files,
        });
        console.log(`[tool] writeFiles done`);
        return result;
      } catch (err) {
        console.error(`[tool] writeFiles error:`, err);
        throw err;
      }
    },
  }),

  runCommand: tool({
    description:
      "Execute a shell command in the sandbox. Use background=true for long-running processes like dev servers.",
    inputSchema: z.object({
      sandboxId: z.string().describe("The sandbox identifier"),
      command: z.string().describe("The shell command to run (e.g. 'npm install')"),
      background: z
        .boolean()
        .default(false)
        .describe(
          "If true, start the command in the background and return immediately. Use for dev servers."
        ),
    }),
    execute: async ({ sandboxId, command, background }) => {
      console.log(`[tool] runCommand sandboxId=${sandboxId} cmd="${command}" bg=${background}`);
      try {
        const result = await callSidecar("/sandbox/run-command", {
          sandbox_id: sandboxId,
          command,
          background,
        });
        console.log(`[tool] runCommand done`);
        return result;
      } catch (err) {
        console.error(`[tool] runCommand error:`, err);
        throw err;
      }
    },
  }),

  getPreviewUrl: tool({
    description:
      "Get the public tunnel URL for the running app on port 3000. May need a few seconds after starting the dev server.",
    inputSchema: z.object({
      sandboxId: z.string().describe("The sandbox identifier"),
    }),
    execute: async ({ sandboxId }) => {
      console.log(`[tool] getPreviewUrl sandboxId=${sandboxId}`);
      try {
        for (let attempt = 0; attempt < 5; attempt++) {
          console.log(`[tool] getPreviewUrl attempt ${attempt + 1}/5`);
          const result = (await callSidecar("/sandbox/tunnel-url", {
            sandbox_id: sandboxId,
          })) as { previewUrl: string | null; status: string };

          if (result.previewUrl) {
            console.log(`[tool] getPreviewUrl ready: ${result.previewUrl}`);
            return { previewUrl: result.previewUrl, status: "ready" as const };
          }
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
        console.warn(`[tool] getPreviewUrl not ready after 5 attempts`);
        return { previewUrl: null, status: "not_ready" as const };
      } catch (err) {
        console.error(`[tool] getPreviewUrl error:`, err);
        throw err;
      }
    },
  }),
};
