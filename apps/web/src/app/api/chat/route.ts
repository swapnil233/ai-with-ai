import { openai } from "@ai-sdk/openai";
import { streamText, convertToModelMessages, pruneMessages, UIMessage, stepCountIs } from "ai";
import { randomUUID } from "crypto";
import { buildSystemPrompt } from "./system-prompt";
import { createSandboxTools } from "./tools";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

const API_URL = process.env.API_URL ?? "http://localhost:4000";

export async function POST(request: Request) {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const { messages, projectId }: { messages: UIMessage[]; projectId: string } =
    await request.json();
  if (!projectId) {
    return new Response(JSON.stringify({ error: "projectId required" }), { status: 400 });
  }

  // Convert UI messages to model messages for the AI
  const modelMessages = await convertToModelMessages(messages);

  // Prune old writeFile tool results to keep context lean.
  // The LLM can use readFile to get current file contents when needed.
  const prunedMessages = pruneMessages({
    messages: modelMessages,
    toolCalls: [{ type: "before-last-message", tools: ["writeFile"] }],
    emptyMessages: "remove",
  });

  // Detect follow-up conversations — any prior assistant message means the
  // sandbox already exists and writes should require a read-first check.
  const isFollowUp = prunedMessages.some((m) => m.role === "assistant");

  // Check sandbox status for recovery instructions
  let sandboxExpired = false;
  if (isFollowUp) {
    try {
      const res = await fetch(`${API_URL}/api/projects/${projectId}/sandbox-status`);
      if (res.ok) {
        const data = (await res.json()) as { status: string };
        sandboxExpired = data.status === "expired";
      }
    } catch {
      // Non-critical — proceed without recovery instructions
    }
  }

  const result = streamText({
    model: openai("gpt-5.2-2025-12-11"),
    system: buildSystemPrompt({ sandboxExpired }),
    messages: prunedMessages,
    tools: createSandboxTools({ isFollowUp, projectId }),
    stopWhen: stepCountIs(10),
    onFinish: async ({ steps }) => {
      // Save messages to DB after streaming completes
      try {
        const messagesToSave: Array<{ id: string; role: string; content: string }> = [];

        // Save the last user message
        const userMessage = messages.filter((m) => m.role === "user").pop();
        if (userMessage) {
          messagesToSave.push({
            id: userMessage.id,
            role: "user",
            content: JSON.stringify(userMessage.parts),
          });
        }

        // Build assistant content from all steps
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const assistantContent: Array<Record<string, any>> = [];
        for (const step of steps) {
          if (step.reasoning.length > 0) {
            for (const r of step.reasoning) {
              assistantContent.push({ type: "reasoning", text: r.text });
            }
          }
          if (step.text) {
            assistantContent.push({ type: "text", text: step.text });
          }
          for (const tc of step.toolCalls) {
            const tr = step.toolResults.find((r) => r.toolCallId === tc.toolCallId);
            assistantContent.push({
              type: "tool-call",
              toolCallId: tc.toolCallId,
              toolName: tc.toolName,
              args: tc.input,
              result: tr?.output,
            });
          }
        }

        if (assistantContent.length > 0) {
          messagesToSave.push({
            id: randomUUID(),
            role: "assistant",
            content: JSON.stringify(assistantContent),
          });
        }

        if (messagesToSave.length > 0) {
          await fetch(`${API_URL}/api/projects/${projectId}/chat/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: session.user.id,
              messages: messagesToSave,
            }),
          });
        }
      } catch (err) {
        console.error("[chat] Failed to save messages:", err);
      }
    },
  });

  // Return the streaming response
  return result.toUIMessageStreamResponse();
}
