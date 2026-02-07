"use client";

import { useState, useEffect, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/auth-provider";
import { useSignOutMutation } from "@/lib/auth-queries";
import {
  useCreateProjectMutation,
  useProjectQuery,
  useProjectsQuery,
} from "@/lib/projects-queries";
import { useChatQuery, deserializeMessages } from "@/lib/chat-queries";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai-elements/reasoning";
import {
  Task,
  TaskTrigger,
  TaskContent,
  TaskItem,
  TaskItemFile,
} from "@/components/ai-elements/task";
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
  Box,
  FileCode,
  Terminal,
  Globe,
  FolderSearch,
  FileSearch,
} from "lucide-react";

const TOOL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "tool-createSandbox": Box,
  "tool-writeFile": FileCode,
  "tool-listFiles": FolderSearch,
  "tool-readFile": FileSearch,
  "tool-runCommand": Terminal,
  "tool-getPreviewUrl": Globe,
};

function getToolDetail(part: { type: string; input?: unknown; output?: unknown; state?: string }) {
  // During input-streaming, partial JSON parsing produces unreliable data
  const inputReady = part.state !== "input-streaming";
  const input = inputReady ? (part.input as Record<string, unknown> | undefined) : undefined;

  switch (part.type) {
    case "tool-createSandbox":
      return { action: "Create sandbox", items: [] as string[] };
    case "tool-writeFile": {
      // Use raw input — filePath is reliable even during streaming
      const rawFilePath = (part.input as Record<string, unknown> | undefined)?.filePath as
        | string
        | undefined;
      return {
        action: "Write file",
        items: rawFilePath ? [rawFilePath.replace(/^\/app\//, "")] : [],
      };
    }
    case "tool-listFiles": {
      const path = input?.path as string | undefined;
      return { action: "List files", items: path ? [path.replace(/^\/app\/?/, "") || "/app"] : [] };
    }
    case "tool-readFile": {
      const filePath = input?.filePath as string | undefined;
      return {
        action: "Read file",
        items: filePath ? [filePath.replace(/^\/app\//, "")] : [],
      };
    }
    case "tool-runCommand": {
      const cmd = input?.command as string | undefined;
      return { action: "Run command", items: cmd ? [cmd] : [] };
    }
    case "tool-getPreviewUrl":
      return { action: "Get preview URL", items: [] as string[] };
    default:
      return { action: part.type.replace("tool-", ""), items: [] as string[] };
  }
}

export default function Home() {
  const { session, isPending } = useAuth();
  const router = useRouter();
  const signOutMutation = useSignOutMutation();
  const createProjectMutation = useCreateProjectMutation();
  const [input, setInput] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const {
    data: projects = [],
    isPending: isProjectsPending,
    error: projectsError,
  } = useProjectsQuery({
    enabled: Boolean(session),
  });
  const selectedProjectIdFromList =
    selectedProjectId && projects.some((project) => project.id === selectedProjectId)
      ? selectedProjectId
      : (projects[0]?.id ?? null);

  const { messages, sendMessage, status, stop, error, setMessages } = useChat({
    id: selectedProjectIdFromList ?? undefined,
  });
  const { data: selectedProject } = useProjectQuery(selectedProjectIdFromList, {
    enabled: Boolean(session),
  });
  const { data: chatData } = useChatQuery(selectedProjectIdFromList, {
    enabled: Boolean(session),
  });
  const isMobilePreview = previewDevice === "mobile";
  const activeProject =
    selectedProject ?? projects.find((project) => project.id === selectedProjectIdFromList) ?? null;

  useEffect(() => {
    if (!isPending && !session) {
      router.push("/login");
    }
  }, [isPending, session, router]);

  // Load chat history when switching projects
  const loadedChatRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      chatData?.messages?.length &&
      selectedProjectIdFromList &&
      loadedChatRef.current !== selectedProjectIdFromList
    ) {
      loadedChatRef.current = selectedProjectIdFromList;
      setMessages(deserializeMessages(chatData.messages));
    }
  }, [chatData, selectedProjectIdFromList, setMessages]);

  // Derive preview URL from the latest getPreviewUrl tool result or persisted sandbox data
  let previewInfo: { url: string; toolCallId?: string } | null = null;
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== "assistant") continue;
    for (const part of msg.parts) {
      if (
        part.type === "tool-getPreviewUrl" &&
        "state" in part &&
        part.state === "output-available" &&
        "output" in part &&
        part.output &&
        typeof part.output === "object" &&
        "previewUrl" in part.output &&
        typeof part.output.previewUrl === "string"
      ) {
        previewInfo = {
          url: part.output.previewUrl,
          toolCallId: "toolCallId" in part ? (part.toolCallId as string) : undefined,
        };
        break;
      }
    }
    if (previewInfo) break;
  }
  // Fall back to persisted sandbox tunnel URL
  if (
    !previewInfo &&
    activeProject?.sandbox?.tunnelUrl &&
    activeProject.sandbox.status === "running"
  ) {
    previewInfo = { url: activeProject.sandbox.tunnelUrl };
  }
  const previewUrl = previewInfo?.url ?? null;

  // Auto-refresh iframe when the agent finishes streaming (files may have changed)
  const prevStatusRef = useRef(status);
  useEffect(() => {
    if (
      prevStatusRef.current === "streaming" &&
      status === "ready" &&
      iframeRef.current &&
      previewUrl
    ) {
      iframeRef.current.src = previewUrl;
    }
    prevStatusRef.current = status;
  }, [status, previewUrl]);

  const handleRefreshPreview = () => {
    if (iframeRef.current && previewUrl) {
      iframeRef.current.src = previewUrl;
    }
  };

  const handleOpenExternal = () => {
    if (previewUrl) {
      window.open(previewUrl, "_blank");
    }
  };

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
    await sendMessage({ text }, { body: { projectId: selectedProjectIdFromList } });
  };

  const handleCreateProject = async () => {
    const name = window.prompt("Enter a project name");

    if (!name || name.trim().length === 0) {
      return;
    }

    try {
      const createdProject = await createProjectMutation.mutateAsync({
        name: name.trim(),
      });
      setSelectedProjectId(createdProject.id);
    } catch {
      // Keep the current selection if project creation fails.
    }
  };

  // Group consecutive reasoning parts together, keep everything else in order
  const getGroupedParts = (message: (typeof messages)[number]) => {
    const groups: Array<
      | { kind: "reasoning"; texts: string[] }
      | { kind: "text"; text: string }
      | { kind: "tool"; part: (typeof message.parts)[number] }
    > = [];

    for (const part of message.parts) {
      if (part.type === "reasoning") {
        const last = groups[groups.length - 1];
        if (last && last.kind === "reasoning") {
          last.texts.push(part.text);
        } else {
          groups.push({ kind: "reasoning", texts: [part.text] });
        }
      } else if (part.type === "text") {
        groups.push({ kind: "text", text: part.text });
      } else if (part.type.startsWith("tool-")) {
        groups.push({ kind: "tool", part });
      }
    }

    return groups;
  };

  return (
    <TooltipProvider>
      <div className="flex h-screen bg-background">
        {/* Left Panel - Chat Interface (30% width) */}
        <div className="flex w-[30%] min-w-[320px] max-w-[480px] flex-col border-r border-border bg-background">
          {/* Chat Header */}
          <header className="flex h-14 items-center justify-between border-b border-border px-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-foreground transition-colors hover:bg-muted">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-violet-500 to-purple-600">
                    <Sparkles className="h-3.5 w-3.5 text-white" />
                  </div>
                  <span className="max-w-[180px] truncate text-sm font-medium">
                    {activeProject?.name ?? (isProjectsPending ? "Loading..." : "My Project")}
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuLabel>Projects</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {isProjectsPending && (
                  <DropdownMenuItem disabled>Loading projects...</DropdownMenuItem>
                )}
                {!isProjectsPending && projects.length === 0 && (
                  <DropdownMenuItem disabled>No projects yet</DropdownMenuItem>
                )}
                {!isProjectsPending &&
                  projects.map((project) => (
                    <DropdownMenuItem
                      key={project.id}
                      onSelect={() => setSelectedProjectId(project.id)}
                      className={cn(selectedProjectIdFromList === project.id && "bg-accent")}
                    >
                      {project.name}
                    </DropdownMenuItem>
                  ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={createProjectMutation.isPending}
                  onSelect={(event) => {
                    event.preventDefault();
                    void handleCreateProject();
                  }}
                >
                  {createProjectMutation.isPending ? "Creating project..." : "New project"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={handleSignOut}
                disabled={signOutMutation.isPending}
              >
                {signOutMutation.isPending ? "Signing out..." : "Sign out"}
              </Button>
            </div>
          </header>

          {/* Chat Messages Area */}
          <Conversation className="flex-1">
            <ConversationContent className="px-4 py-4 gap-4">
              {messages.length === 0 ? (
                <Message from="assistant">
                  <MessageContent>
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

                    if (message.role === "user") {
                      const messageText = message.parts
                        .filter(
                          (part): part is { type: "text"; text: string } => part.type === "text"
                        )
                        .map((part) => part.text)
                        .join("");
                      return (
                        <Message key={message.id} from="user">
                          <MessageContent className="bg-muted">
                            <p className="text-sm">{messageText}</p>
                          </MessageContent>
                        </Message>
                      );
                    }

                    // Assistant: render parts sequentially to preserve order
                    const groups = getGroupedParts(message);
                    const hasContent = groups.some(
                      (g) =>
                        (g.kind === "text" && g.text.trim()) ||
                        g.kind === "tool" ||
                        g.kind === "reasoning"
                    );

                    return (
                      <Message key={message.id} from="assistant">
                        {groups.map((group, i) => {
                          if (group.kind === "reasoning") {
                            return (
                              <Reasoning
                                key={`reasoning-${i}`}
                                isStreaming={isStreaming}
                                defaultOpen={isStreaming}
                              >
                                <ReasoningTrigger />
                                <ReasoningContent>{group.texts.join("\n\n")}</ReasoningContent>
                              </Reasoning>
                            );
                          }

                          if (group.kind === "tool") {
                            const part = group.part;
                            const isComplete = "state" in part && part.state === "output-available";
                            const isError = "state" in part && part.state === "output-error";
                            const ToolIcon = TOOL_ICONS[part.type] ?? Terminal;
                            const { action, items } = getToolDetail(
                              part as Parameters<typeof getToolDetail>[0]
                            );
                            const isFileType = part.type === "tool-writeFile";
                            const toolKey = "toolCallId" in part ? part.toolCallId : `tool-${i}`;

                            // File writes: use Task component with expandable file list
                            if (isFileType && items.length > 0) {
                              return (
                                <Task key={toolKey} defaultOpen>
                                  <TaskTrigger title={action}>
                                    <div className="flex w-full cursor-pointer items-center gap-2 text-sm transition-colors hover:text-foreground">
                                      {isComplete ? (
                                        <ToolIcon className="size-4 shrink-0 text-emerald-600" />
                                      ) : isError ? (
                                        <ToolIcon className="size-4 shrink-0 text-red-500" />
                                      ) : (
                                        <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
                                      )}
                                      <span
                                        className={cn(
                                          "text-sm",
                                          isComplete
                                            ? "text-emerald-600"
                                            : isError
                                              ? "text-red-500"
                                              : "text-muted-foreground"
                                        )}
                                      >
                                        {action}
                                      </span>
                                      <ChevronDown className="size-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                                    </div>
                                  </TaskTrigger>
                                  <TaskContent>
                                    {items.map((item, j) => (
                                      <TaskItem key={j}>
                                        <TaskItemFile>
                                          <FileCode className="size-3.5 text-muted-foreground" />
                                          <span>{item}</span>
                                        </TaskItemFile>
                                      </TaskItem>
                                    ))}
                                  </TaskContent>
                                </Task>
                              );
                            }

                            // All other tools: simple inline row
                            return (
                              <div key={toolKey} className="flex items-center gap-2 py-0.5 text-sm">
                                {isComplete ? (
                                  <ToolIcon className="size-4 shrink-0 text-emerald-600" />
                                ) : isError ? (
                                  <ToolIcon className="size-4 shrink-0 text-red-500" />
                                ) : (
                                  <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
                                )}
                                <span
                                  className={cn(
                                    "text-sm",
                                    isComplete
                                      ? "text-emerald-600"
                                      : isError
                                        ? "text-red-500"
                                        : "text-muted-foreground"
                                  )}
                                >
                                  {action}
                                </span>
                                {items.length > 0 && (
                                  <code className="truncate text-xs text-muted-foreground font-mono">
                                    {items[0]}
                                  </code>
                                )}
                              </div>
                            );
                          }

                          if (group.kind === "text" && group.text.trim()) {
                            return (
                              <MessageContent key={`text-${i}`} className="text-foreground">
                                <MessageResponse>{group.text}</MessageResponse>
                              </MessageContent>
                            );
                          }

                          return null;
                        })}
                        {isStreaming && !hasContent && (
                          <MessageContent className="text-foreground">
                            <span className="inline-block h-4 w-1 animate-pulse bg-foreground/50" />
                          </MessageContent>
                        )}
                      </Message>
                    );
                  })}

                  {/* Show typing indicator when waiting for AI response */}
                  {status === "submitted" && (
                    <Message from="assistant">
                      <MessageContent className="text-foreground">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Thinking...</span>
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
          <div className="border-t border-border p-4">
            <PromptInput
              onSubmit={(message) => {
                handleSendMessage(message.text);
              }}
              className="rounded-xl bg-muted"
            >
              <PromptInputTextarea
                autoFocus
                placeholder="Describe the app you want to build..."
                className="min-h-[44px] bg-transparent text-foreground placeholder:text-muted-foreground"
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
            {(error || projectsError || createProjectMutation.isError) && (
              <div className="mt-2 flex flex-col items-center gap-1">
                {error && <span className="text-xs text-red-500">Error: {error.message}</span>}
                {projectsError && (
                  <span className="text-xs text-red-500">Projects: {projectsError.message}</span>
                )}
                {createProjectMutation.isError && (
                  <span className="text-xs text-red-500">
                    Create project: {createProjectMutation.error.message}
                  </span>
                )}
              </div>
            )}
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
                onClick={handleRefreshPreview}
                disabled={!previewUrl}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={handleOpenExternal}
                disabled={!previewUrl}
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
                  <div className="mx-auto max-w-md truncate rounded-md bg-white dark:bg-gray-800 px-3 py-1 text-center text-xs text-muted-foreground">
                    {previewUrl ?? "localhost:3000"}
                  </div>
                </div>
              </div>

              {/* Actual preview content */}
              {previewUrl ? (
                <iframe
                  key={previewInfo?.toolCallId}
                  ref={iframeRef}
                  src={previewUrl}
                  className="flex-1 w-full bg-white dark:bg-gray-800"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                  title="App preview"
                />
              ) : (
                <div className="flex flex-1 items-center justify-center bg-white dark:bg-gray-800">
                  <div className="text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600">
                      <Sparkles className="h-8 w-8 text-white" />
                    </div>
                    <h2 className="mb-2 text-lg font-semibold text-foreground">
                      {activeProject?.name ?? "Your app preview"}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {activeProject
                        ? "Start a conversation to generate and iterate on this application"
                        : "Create a project and start a conversation to generate your application"}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
