"use client";

import { useState, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/auth-provider";
import { useSignOutMutation } from "@/lib/auth-queries";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai-elements/reasoning";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputTools,
  PromptInputButton,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import {
  ChevronDown,
  Share,
  Github,
  Code2,
  Eye,
  Monitor,
  Smartphone,
  RotateCcw,
  ExternalLink,
  Sparkles,
  Paperclip,
  Loader2,
} from "lucide-react";

export default function Home() {
  const { session, isPending } = useAuth();
  const router = useRouter();
  const signOutMutation = useSignOutMutation();
  const [input, setInput] = useState("");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");

  const { messages, sendMessage, status, stop, error } = useChat();
  const isMobilePreview = previewDevice === "mobile";

  useEffect(() => {
    if (!isPending && !session) {
      router.push("/login");
    }
  }, [isPending, session, router]);

  const handleSignOut = async () => {
    try {
      await signOutMutation.mutateAsync();
      router.push("/login");
      router.refresh();
    } catch {
      // Keep user in place if sign-out fails.
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;
    setInput("");
    await sendMessage({ text });
  };

  // Helper to extract text content from message parts
  const getTextParts = (message: (typeof messages)[number]) => {
    return message.parts.filter(
      (part): part is { type: "text"; text: string } => part.type === "text"
    );
  };

  // Helper to extract reasoning parts from message parts
  const getReasoningParts = (message: (typeof messages)[number]) => {
    return message.parts.filter(
      (part): part is { type: "reasoning"; text: string } => part.type === "reasoning"
    );
  };

  return (
    <TooltipProvider>
      <div className="flex h-screen bg-background">
        {/* Left Panel - Chat Interface (30% width) */}
        <div className="flex w-[30%] min-w-[320px] max-w-[480px] flex-col bg-chat-bg">
          {/* Chat Header */}
          <header className="flex h-14 items-center justify-between border-b border-chat-border px-4">
            <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-chat-foreground transition-colors hover:bg-chat-input-bg">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-violet-500 to-purple-600">
                <Sparkles className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-sm font-medium">My Project</span>
              <ChevronDown className="h-4 w-4 text-chat-muted" />
            </button>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-chat-muted hover:bg-chat-input-bg hover:text-chat-foreground"
                onClick={handleSignOut}
                disabled={signOutMutation.isPending}
              >
                {signOutMutation.isPending ? "Signing out..." : "Sign out"}
              </Button>
            </div>
          </header>

          {/* Chat Messages Area */}
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
                          className={
                            message.role === "user" ? "bg-white text-gray-900" : "text-white"
                          }
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

          {/* Chat Input Area */}
          <div className="border-t border-chat-border p-4">
            <PromptInput
              onSubmit={(message) => {
                handleSendMessage(message.text);
              }}
              className="rounded-xl bg-chat-input-bg"
            >
              <PromptInputTextarea
                placeholder="Describe the app you want to build..."
                className="min-h-[44px] bg-transparent text-chat-foreground placeholder:text-chat-muted"
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
              <PromptInputFooter className="px-3 pb-3">
                <PromptInputTools>
                  <PromptInputButton tooltip="Attach files">
                    <Paperclip className="h-4 w-4" />
                  </PromptInputButton>
                </PromptInputTools>
                <PromptInputSubmit status={status} onStop={stop} disabled={!input.trim()} />
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
              <span className="text-xs text-chat-muted" suppressHydrationWarning>
                {isPending ? "Checking session..." : (session?.user?.email ?? "")}
              </span>
            </div>
          </div>
        </div>

        {/* Right Panel - Preview Area (70% width) */}
        <div className="flex flex-1 flex-col bg-gray-100 dark:bg-gray-900">
          {/* Preview Header */}
          <header className="flex h-14 items-center justify-between border-b border-border bg-white dark:bg-gray-800 px-4">
            <div className="flex items-center gap-2">
              {/* Preview Controls */}
              <div className="flex items-center rounded-lg bg-muted p-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 rounded-md bg-white dark:bg-gray-700 px-3 text-xs font-medium shadow-sm"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Preview
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 rounded-md px-3 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  <Code2 className="h-3.5 w-3.5" />
                  Code
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {/* Device toggles */}
              <Button
                variant="ghost"
                size="icon"
                aria-label="Desktop preview"
                aria-pressed={!isMobilePreview}
                className={cn(
                  "h-8 w-8 text-muted-foreground hover:text-foreground",
                  !isMobilePreview && "bg-muted text-foreground hover:bg-muted"
                )}
                onClick={() => setPreviewDevice("desktop")}
              >
                <Monitor className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Mobile preview"
                aria-pressed={isMobilePreview}
                className={cn(
                  "h-8 w-8 text-muted-foreground hover:text-foreground",
                  isMobilePreview && "bg-muted text-foreground hover:bg-muted"
                )}
                onClick={() => setPreviewDevice("mobile")}
              >
                <Smartphone className="h-4 w-4" />
              </Button>
              <div className="mx-2 h-4 w-px bg-border" />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                <Share className="h-3.5 w-3.5" />
                Share
              </Button>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                <Github className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" className="h-8 text-xs">
                Publish
              </Button>
            </div>
          </header>

          {/* Preview Content Area */}
          <div className="flex flex-1 items-center justify-center p-6">
            <div
              className={cn(
                "flex h-full w-full flex-col overflow-hidden border border-border bg-white shadow-sm transition-all duration-300 dark:bg-gray-800",
                isMobilePreview ? "max-h-[760px] max-w-[390px] rounded-[28px]" : "rounded-lg"
              )}
            >
              {/* Browser-like frame */}
              <div className="flex h-10 items-center gap-2 border-b border-border bg-gray-50 dark:bg-gray-900 px-4">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-red-400" />
                  <div className="h-3 w-3 rounded-full bg-yellow-400" />
                  <div className="h-3 w-3 rounded-full bg-green-400" />
                </div>
                <div className="ml-4 flex-1">
                  <div className="mx-auto max-w-md rounded-md bg-white dark:bg-gray-800 px-3 py-1 text-center text-xs text-muted-foreground">
                    localhost:3000
                  </div>
                </div>
              </div>

              {/* Actual preview content */}
              <div className="flex flex-1 items-center justify-center bg-white dark:bg-gray-800">
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600">
                    <Sparkles className="h-8 w-8 text-white" />
                  </div>
                  <h2 className="mb-2 text-lg font-semibold text-foreground">Your app preview</h2>
                  <p className="text-sm text-muted-foreground">
                    Start a conversation to generate your application
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
