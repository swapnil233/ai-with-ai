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

/**
 * Create sandbox tools with per-request state tracking.
 *
 * `projectId` is injected automatically — the LLM never needs to supply it.
 *
 * During follow-up edits (`isFollowUp: true`), writes to existing files are
 * blocked unless the file has been read first in the current request. This
 * forces the LLM to call listFiles → readFile → writeFile instead of guessing
 * file contents from pruned context.
 */
export function createSandboxTools({
  isFollowUp,
  projectId,
}: {
  isFollowUp: boolean;
  projectId: string;
}) {
  // Tracks files discovered via listFiles — these exist in the sandbox
  const knownExistingFiles = new Set<string>();
  // Tracks files read (or attempted) via readFile in this request
  const readPaths = new Set<string>();
  // Tracks files written in this request (so sequential writes don't require re-read)
  const writtenPaths = new Set<string>();

  return {
    createSandbox: tool({
      description:
        "Create a new Modal sandbox environment with Node.js 20. Call this first before writing files or running commands.",
      inputSchema: z.object({}),
      execute: async () => {
        console.log(`[tool] createSandbox projectId=${projectId}`);
        try {
          const result = await callSidecar("/sandbox/create", { sandbox_id: projectId });
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
        filePath: z.string().describe("Absolute path within the sandbox (e.g. /app/package.json)"),
        content: z.string().describe("The full file content to write"),
      }),
      execute: async ({ filePath, content }) => {
        console.log(
          `[tool] writeFile projectId=${projectId} path=${filePath} (${content.length} chars)`
        );
        if (
          isFollowUp &&
          knownExistingFiles.has(filePath) &&
          !readPaths.has(filePath) &&
          !writtenPaths.has(filePath)
        ) {
          console.warn(`[tool] writeFile BLOCKED — file not read: ${filePath}`);
          return {
            error: `You must call readFile on "${filePath}" before writing to it. The file exists in the sandbox but its contents are not in your context.`,
          };
        }
        try {
          const result = await callSidecar("/sandbox/write-files", {
            sandbox_id: projectId,
            files: { [filePath]: content },
          });
          writtenPaths.add(filePath);
          console.log(`[tool] writeFile done`);
          return result;
        } catch (err) {
          console.error(`[tool] writeFile error:`, err);
          throw err;
        }
      },
    }),

    listFiles: tool({
      description:
        "List files in the sandbox. Use this to see the project structure before reading or editing files.",
      inputSchema: z.object({
        path: z.string().default("/app").describe("Directory path to list (default: /app)"),
      }),
      execute: async ({ path }) => {
        console.log(`[tool] listFiles projectId=${projectId} path=${path}`);
        try {
          const result = (await callSidecar("/sandbox/list-files", {
            sandbox_id: projectId,
            path,
          })) as { files: string[] };
          for (const f of result.files) knownExistingFiles.add(f);
          console.log(`[tool] listFiles done (${result.files.length} files)`);
          return result;
        } catch (err) {
          console.error(`[tool] listFiles error:`, err);
          throw err;
        }
      },
    }),

    readFile: tool({
      description:
        "Read a file from the sandbox. Use this to understand existing code before making edits.",
      inputSchema: z.object({
        filePath: z
          .string()
          .describe("Absolute path of the file to read (e.g. /app/src/app/page.tsx)"),
      }),
      execute: async ({ filePath }) => {
        console.log(`[tool] readFile projectId=${projectId} path=${filePath}`);
        // Always mark as read — even if the file doesn't exist, the LLM has
        // acknowledged the path and can now write to it freely.
        readPaths.add(filePath);
        try {
          const result = await callSidecar("/sandbox/read-file", {
            sandbox_id: projectId,
            file_path: filePath,
          });
          console.log(`[tool] readFile done`);
          return result;
        } catch (err) {
          console.error(`[tool] readFile error:`, err);
          throw err;
        }
      },
    }),

    runCommand: tool({
      description:
        "Execute a shell command in the sandbox. Use background=true for long-running processes like dev servers.",
      inputSchema: z.object({
        command: z.string().describe("The shell command to run (e.g. 'npm install')"),
        background: z
          .boolean()
          .default(false)
          .describe(
            "If true, start the command in the background and return immediately. Use for dev servers."
          ),
      }),
      execute: async ({ command, background }) => {
        console.log(`[tool] runCommand projectId=${projectId} cmd="${command}" bg=${background}`);
        try {
          const result = await callSidecar("/sandbox/run-command", {
            sandbox_id: projectId,
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
      inputSchema: z.object({}),
      execute: async () => {
        console.log(`[tool] getPreviewUrl projectId=${projectId}`);
        try {
          for (let attempt = 0; attempt < 5; attempt++) {
            console.log(`[tool] getPreviewUrl attempt ${attempt + 1}/5`);
            const result = (await callSidecar("/sandbox/tunnel-url", {
              sandbox_id: projectId,
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
}
