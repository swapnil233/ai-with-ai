"use client";

import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputTools,
  PromptInputButton,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { Paperclip } from "lucide-react";

interface ChatInputProps {
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: (text: string) => void;
  status: "submitted" | "streaming" | "ready" | "error";
  onStop: () => void;
  error?: Error;
  userEmail?: string;
}

export function ChatInput({
  input,
  onInputChange,
  onSubmit,
  status,
  onStop,
  error,
  userEmail,
}: ChatInputProps) {
  const handleSubmit = (message: { text: string }) => {
    onSubmit(message.text);
  };

  return (
    <div className="border-t border-chat-border p-4">
      <PromptInput onSubmit={handleSubmit} className="rounded-xl bg-chat-input-bg">
        <PromptInputTextarea
          placeholder="Describe the app you want to build..."
          className="min-h-[44px] bg-transparent text-chat-foreground placeholder:text-chat-muted"
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
        />
        <PromptInputFooter className="px-3 pb-3">
          <PromptInputTools>
            <PromptInputButton tooltip="Attach files">
              <Paperclip className="h-4 w-4" />
            </PromptInputButton>
          </PromptInputTools>
          <PromptInputSubmit status={status} onStop={onStop} disabled={!input.trim()} />
        </PromptInputFooter>
      </PromptInput>
      <div className="mt-3 flex flex-col items-center gap-1">
        {error && <span className="text-xs text-red-500">Error: {error.message}</span>}
        {status === "submitted" && (
          <span className="text-xs text-chat-muted">Sending message...</span>
        )}
        {status === "streaming" && (
          <span className="text-xs text-chat-muted">AI is responding...</span>
        )}
        {status === "ready" && <span className="text-xs text-chat-muted">{userEmail}</span>}
      </div>
    </div>
  );
}
