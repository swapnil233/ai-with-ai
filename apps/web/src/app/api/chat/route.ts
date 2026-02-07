import { openai } from "@ai-sdk/openai";
import { streamText, convertToModelMessages, pruneMessages, UIMessage, stepCountIs } from "ai";
import { systemPrompt } from "./system-prompt";
import { createSandboxTools } from "./tools";

export async function POST(request: Request) {
  const { messages }: { messages: UIMessage[] } = await request.json();

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

  const result = streamText({
    model: openai("gpt-5.2-2025-12-11"),
    system: systemPrompt,
    messages: prunedMessages,
    tools: createSandboxTools({ isFollowUp }),
    stopWhen: stepCountIs(10),
  });

  // Return the streaming response
  return result.toUIMessageStreamResponse();
}
