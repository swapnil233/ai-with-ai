import { anthropic } from "@ai-sdk/anthropic";
import { streamText, convertToModelMessages, UIMessage } from "ai";
import { systemPrompt } from "./system-prompt";

export async function POST(request: Request) {
  const { messages }: { messages: UIMessage[] } = await request.json();

  // Convert UI messages to model messages for the AI
  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: anthropic("claude-sonnet-4-5-20250929"),
    system: systemPrompt,
    messages: modelMessages,
    // Tools will be added here for app building functionality
    // tools: {
    //   createFile: { ... },
    //   runCommand: { ... },
    //   deployToSandbox: { ... },
    // },
  });

  // Return the streaming response
  return result.toUIMessageStreamResponse();
}
