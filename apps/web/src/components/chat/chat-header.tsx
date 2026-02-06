"use client";

import { Button } from "@/components/ui/button";
import { ChevronDown, Sparkles } from "lucide-react";

interface ChatHeaderProps {
  onSignOut: () => void;
}

export function ChatHeader({ onSignOut }: ChatHeaderProps) {
  return (
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
          onClick={onSignOut}
        >
          Sign out
        </Button>
      </div>
    </header>
  );
}
