import { tool } from "ai";
import { z } from "zod";

const SANDBOX_SERVICE_URL = process.env.SANDBOX_SERVICE_URL ?? "http://localhost:8000";

async function callSidecar(endpoint: string, body: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${SANDBOX_SERVICE_URL}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Sidecar ${endpoint} failed (${res.status}): ${detail}`);
  }
  return res.json();
}

export const sandboxTools = {
  createSandbox: tool({
    description:
      "Create a new Modal sandbox environment with Node.js 20. Call this first before writing files or running commands.",
    inputSchema: z.object({
      sandboxId: z.string().describe("Unique identifier for the sandbox, typically the project ID"),
    }),
    execute: async ({ sandboxId }) => {
      return callSidecar("/sandbox/create", { sandbox_id: sandboxId });
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
      return callSidecar("/sandbox/write-files", {
        sandbox_id: sandboxId,
        files: { [filePath]: content },
      });
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
      return callSidecar("/sandbox/write-files", {
        sandbox_id: sandboxId,
        files,
      });
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
      return callSidecar("/sandbox/run-command", {
        sandbox_id: sandboxId,
        command,
        background,
      });
    },
  }),

  getPreviewUrl: tool({
    description:
      "Get the public tunnel URL for the running app on port 3000. May need a few seconds after starting the dev server.",
    inputSchema: z.object({
      sandboxId: z.string().describe("The sandbox identifier"),
    }),
    execute: async ({ sandboxId }) => {
      // Poll up to 5 times with 2s delay for the tunnel to become ready
      for (let attempt = 0; attempt < 5; attempt++) {
        const result = (await callSidecar("/sandbox/tunnel-url", {
          sandbox_id: sandboxId,
        })) as { previewUrl: string | null; status: string };

        if (result.previewUrl) {
          return { previewUrl: result.previewUrl, status: "ready" as const };
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      return { previewUrl: null, status: "not_ready" as const };
    },
  }),
};
