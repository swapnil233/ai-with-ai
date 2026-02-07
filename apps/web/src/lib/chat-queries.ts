import { useQuery } from "@tanstack/react-query";
import type { UIMessage } from "ai";

const API_BASE_URL = "";

interface DbMessage {
  id: string;
  role: string;
  content: string;
  createdAt: string;
}

interface ChatResponse {
  chat: {
    id: string;
    projectId: string;
    userId: string;
    createdAt: string;
    updatedAt: string;
  } | null;
  messages: DbMessage[];
}

interface UseChatQueryOptions {
  enabled?: boolean;
}

const chatQueryKeys = {
  chat: (projectId: string) => ["chat", projectId] as const,
};

const fetchChat = async (projectId: string): Promise<ChatResponse> => {
  const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/chat`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch chat history");
  }

  return (await response.json()) as ChatResponse;
};

/**
 * Deserialize DB messages back into UIMessage format.
 * DB stores `content` as JSON.stringify(message.parts) for user messages
 * and JSON.stringify(message.content) for assistant messages.
 */
export function deserializeMessages(dbMessages: DbMessage[]): UIMessage[] {
  const uiMessages: UIMessage[] = [];

  for (const msg of dbMessages) {
    try {
      const parsed = JSON.parse(msg.content);

      if (msg.role === "user") {
        // User messages: content is serialized parts array
        uiMessages.push({
          id: msg.id,
          role: "user",
          parts: Array.isArray(parsed) ? parsed : [{ type: "text" as const, text: String(parsed) }],
        });
      } else if (msg.role === "assistant") {
        // Assistant messages: content is serialized model content array
        // We need to convert model content back to UI parts
        const parts: UIMessage["parts"] = [];

        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item.type === "text" && typeof item.text === "string") {
              parts.push({ type: "text" as const, text: item.text });
            } else if (item.type === "reasoning" && typeof item.text === "string") {
              parts.push({ type: "reasoning" as const, text: item.text });
            } else if (item.type === "tool-call") {
              // Reconstruct tool invocation parts
              const toolType = `tool-${item.toolName}` as UIMessage["parts"][number]["type"];
              parts.push({
                type: toolType,
                toolCallId: item.toolCallId,
                toolName: item.toolName,
                args: item.args,
                state: "output-available",
                output: item.result ?? {},
              } as UIMessage["parts"][number]);
            }
          }
        }

        if (parts.length === 0) {
          parts.push({ type: "text" as const, text: typeof parsed === "string" ? parsed : "" });
        }

        uiMessages.push({
          id: msg.id,
          role: "assistant",
          parts,
        });
      }
    } catch {
      // If JSON parsing fails, treat as plain text
      uiMessages.push({
        id: msg.id,
        role: msg.role as "user" | "assistant",
        parts: [{ type: "text" as const, text: msg.content }],
      });
    }
  }

  return uiMessages;
}

export const useChatQuery = (projectId: string | null, options?: UseChatQueryOptions) =>
  useQuery<ChatResponse, Error>({
    queryFn: async () => {
      if (!projectId) {
        throw new Error("Project ID is required");
      }
      return fetchChat(projectId);
    },
    queryKey: chatQueryKeys.chat(projectId ?? "empty"),
    enabled: Boolean(projectId) && (options?.enabled ?? true),
  });

export { chatQueryKeys };
