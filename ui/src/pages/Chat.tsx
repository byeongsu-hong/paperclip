import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@/lib/router";
import { chatApi } from "@/api/chat";
import { useCompany } from "@/context/CompanyContext";
import { Button } from "@/components/ui/button";
import { MessageSquare, Plus } from "lucide-react";

export function Chat() {
  const { selectedCompanyId } = useCompany();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["chat", "sessions", selectedCompanyId],
    queryFn: () => chatApi.listSessions(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const createSession = useMutation({
    mutationFn: () => chatApi.createSession(selectedCompanyId!, "New Chat"),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ["chat", "sessions", selectedCompanyId] });
      navigate(`/chat/${res.session.id}`);
    },
  });

  if (!selectedCompanyId) {
    return <div className="p-6 text-sm text-muted-foreground">No company selected.</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <h1 className="text-base font-semibold">Chat</h1>
        <Button
          size="sm"
          onClick={() => createSession.mutate()}
          disabled={createSession.isPending}
        >
          <Plus className="h-4 w-4 mr-1" />
          New Chat
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : (data?.sessions.length ?? 0) === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
            <MessageSquare className="h-8 w-8" />
            <p className="text-sm">No chat sessions yet. Start a new chat.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {data?.sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => navigate(`/chat/${session.id}`)}
                className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border hover:bg-accent/50 text-left transition-colors"
              >
                <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{session.title ?? "Untitled"}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(session.updatedAt).toLocaleString()}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
