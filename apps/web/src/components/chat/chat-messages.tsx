"use client";

import type { UIMessage } from "ai";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai-elements/reasoning";
import { Loader2 } from "lucide-react";

interface ChatMessagesProps {
  messages: UIMessage[];
  status: "submitted" | "streaming" | "ready" | "error";
}

// Helper to extract text content from message parts
function getTextParts(message: UIMessage) {
  return message.parts.filter(
    (part): part is { type: "text"; text: string } => part.type === "text"
  );
}

// Helper to extract reasoning parts from message parts
function getReasoningParts(message: UIMessage) {
  return message.parts.filter(
    (part): part is { type: "reasoning"; text: string } => part.type === "reasoning"
  );
}

export function ChatMessages({ messages, status }: ChatMessagesProps) {
  return (
    <Conversation className="flex-1 bg-chat-bg">
      <ConversationContent className="px-4 py-4 gap-4">
        {messages.length === 0 ? (
          <Message from="assistant">
            <MessageContent className="text-white">
              <p className="text-sm leading-relaxed">
                Welcome! I&apos;m your AI assistant. Describe the app you want to build and
                I&apos;ll help you create it.
              </p>
            </MessageContent>
          </Message>
        ) : (
          <>
            {messages.map((message, index) => {
              const isLastMessage = index === messages.length - 1;
              const isStreaming =
                isLastMessage && status === "streaming" && message.role === "assistant";
              const textParts = getTextParts(message);
              const reasoningParts = getReasoningParts(message);
              const messageText = textParts.map((part) => part.text).join("");

              return (
                <Message key={message.id} from={message.role}>
                  {/* Show reasoning/thinking if present */}
                  {message.role === "assistant" && reasoningParts.length > 0 && (
                    <Reasoning isStreaming={isStreaming} defaultOpen={isStreaming}>
                      <ReasoningTrigger />
                      <ReasoningContent>
                        {reasoningParts.map((part) => part.text).join("\n\n")}
                      </ReasoningContent>
                    </Reasoning>
                  )}

                  <MessageContent
                    className={message.role === "user" ? "bg-white text-gray-900" : "text-white"}
                  >
                    {message.role === "assistant" ? (
                      <>
                        <MessageResponse>{messageText}</MessageResponse>
                        {isStreaming && !messageText && (
                          <span className="inline-block h-4 w-1 animate-pulse bg-chat-foreground/50" />
                        )}
                      </>
                    ) : (
                      <p className="text-sm">{messageText}</p>
                    )}
                  </MessageContent>
                </Message>
              );
            })}

            {/* Show typing indicator when waiting for AI response */}
            {status === "submitted" && (
              <Message from="assistant">
                <MessageContent className="text-white">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
                    <span className="text-sm text-zinc-400">Thinking...</span>
                  </div>
                </MessageContent>
              </Message>
            )}
          </>
        )}
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  );
}
