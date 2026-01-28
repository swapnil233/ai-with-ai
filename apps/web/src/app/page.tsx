"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/components/providers/auth-provider";
import { signOut } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
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
  Plus,
  Send,
  Sparkles,
} from "lucide-react";

export default function Home() {
  const { session, isPending } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
    router.refresh();
  };

  if (isPending) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
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
            >
              Sign out
            </Button>
          </div>
        </header>

        {/* Chat Messages Area */}
        <ScrollArea className="flex-1 px-4 py-4">
          <div className="space-y-6">
            {/* Welcome message - placeholder for AI messages */}
            <div className="space-y-3">
              <div className="text-xs text-chat-muted">Today</div>
              <div className="rounded-xl bg-chat-input-bg p-4">
                <p className="text-sm leading-relaxed text-chat-foreground">
                  Welcome! I&apos;m your AI assistant. Describe the app you want to build and
                  I&apos;ll help you create it.
                </p>
              </div>
            </div>

            {/* Placeholder for chat messages - will be implemented with Vercel AI SDK */}
          </div>
        </ScrollArea>

        {/* Chat Input Area */}
        <div className="border-t border-chat-border p-4">
          <div className="rounded-xl bg-chat-input-bg p-3">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-chat-muted hover:bg-chat-border hover:text-chat-foreground"
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Input
                placeholder="Ask anything..."
                className="flex-1 border-0 bg-transparent text-sm text-chat-foreground placeholder:text-chat-muted focus-visible:ring-0"
              />
              <Button
                size="icon"
                className="h-8 w-8 shrink-0 rounded-full bg-white text-chat-bg hover:bg-gray-100"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-center">
            <span className="text-xs text-chat-muted">{session?.user?.email}</span>
          </div>
        </div>
      </div>

      {/* Right Panel - Preview Area (70% width) */}
      <div className="flex flex-1 flex-col bg-gray-100">
        {/* Preview Header */}
        <header className="flex h-14 items-center justify-between border-b border-border bg-white px-4">
          <div className="flex items-center gap-2">
            {/* Preview Controls */}
            <div className="flex items-center rounded-lg bg-muted p-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 rounded-md bg-white px-3 text-xs font-medium shadow-sm"
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
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <Monitor className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
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
          <div className="flex h-full w-full flex-col overflow-hidden rounded-lg border border-border bg-white shadow-sm">
            {/* Browser-like frame */}
            <div className="flex h-10 items-center gap-2 border-b border-border bg-gray-50 px-4">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-red-400" />
                <div className="h-3 w-3 rounded-full bg-yellow-400" />
                <div className="h-3 w-3 rounded-full bg-green-400" />
              </div>
              <div className="ml-4 flex-1">
                <div className="mx-auto max-w-md rounded-md bg-white px-3 py-1 text-center text-xs text-muted-foreground">
                  localhost:3000
                </div>
              </div>
            </div>

            {/* Actual preview content */}
            <div className="flex flex-1 items-center justify-center bg-white">
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
  );
}
