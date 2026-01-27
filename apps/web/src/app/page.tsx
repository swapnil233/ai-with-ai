import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

export default function Home() {
  return (
    <div className="flex h-screen bg-background">
      {/* Left Panel - Chat Interface */}
      <div className="flex w-1/2 flex-col border-r">
        <header className="flex h-14 items-center border-b px-4">
          <h1 className="text-lg font-semibold">AI App Builder</h1>
        </header>

        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {/* Placeholder for chat messages */}
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">
                Welcome! Describe the app you want to build and I&apos;ll help you create it.
              </p>
            </Card>
          </div>
        </ScrollArea>

        <Separator />

        <div className="p-4">
          <form className="flex gap-2">
            <Input placeholder="Describe your app idea..." className="flex-1" />
            <Button type="submit">Send</Button>
          </form>
        </div>
      </div>

      {/* Right Panel - Code Preview / Editor */}
      <div className="flex w-1/2 flex-col">
        <header className="flex h-14 items-center justify-between border-b px-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Preview</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              Code
            </Button>
            <Button variant="outline" size="sm">
              Preview
            </Button>
          </div>
        </header>

        <div className="flex flex-1 items-center justify-center bg-muted/30">
          <div className="text-center text-muted-foreground">
            <p className="text-sm">Your app preview will appear here</p>
            <p className="mt-1 text-xs">Start a conversation to generate code</p>
          </div>
        </div>
      </div>
    </div>
  );
}
