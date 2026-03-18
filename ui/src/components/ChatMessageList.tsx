import type { ChatMessage } from "@/api/chat";
import { cn } from "@/lib/utils";

export function ChatMessageList({ messages }: { messages: ChatMessage[] }) {
  return (
    <div className="flex flex-col gap-3 p-4">
      {messages.map((msg) => (
        <div key={msg.id} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
          <div
            className={cn(
              "max-w-[70%] rounded-lg px-4 py-2 text-sm",
              msg.role === "user"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground"
            )}
          >
            {msg.content}
          </div>
        </div>
      ))}
    </div>
  );
}
