import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "@/lib/router";
import { chatApi } from "@/api/chat";
import { ChatMessageList } from "@/components/ChatMessageList";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Send } from "lucide-react";

export function ChatSession() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["chat", "messages", sessionId],
    queryFn: () => chatApi.listMessages(sessionId!),
    enabled: !!sessionId,
    refetchInterval: 3000,
  });

  const sendMessage = useMutation({
    mutationFn: (content: string) => chatApi.sendMessage(sessionId!, content),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["chat", "messages", sessionId] });
      setInput("");
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data?.messages.length]);

  function handleSend() {
    const content = input.trim();
    if (!content || sendMessage.isPending) return;
    sendMessage.mutate(content);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 border-b border-border flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" onClick={() => navigate("/chat")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">Chat</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-sm text-muted-foreground">Loading...</div>
        ) : (
          <ChatMessageList messages={data?.messages ?? []} />
        )}
        <div ref={bottomRef} />
      </div>

      <div className="px-4 py-3 border-t border-border flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          rows={1}
          className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring min-h-[38px] max-h-40"
        />
        <Button
          size="sm"
          onClick={handleSend}
          disabled={!input.trim() || sendMessage.isPending}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
