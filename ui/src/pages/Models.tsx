import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { modelsApi, type CliAuthStatus } from "@/api/models";
import { CliAuthTerminal } from "@/components/CliAuthTerminal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, FolderOpen, Cpu } from "lucide-react";

type CliTool = {
  id: string;
  label: string;
  description: string;
};

const CLI_TOOLS: CliTool[] = [
  { id: "claude", label: "Claude Code", description: "Anthropic Claude coding assistant" },
  { id: "gemini", label: "Gemini CLI", description: "Google Gemini coding assistant" },
  { id: "codex", label: "Codex CLI", description: "OpenAI Codex coding assistant" },
];

function StatusBadge({ status }: { status: CliAuthStatus | undefined }) {
  if (!status || status === "not-installed") {
    return (
      <Badge variant="secondary" className="gap-1 text-muted-foreground">
        <XCircle className="h-3 w-3" /> Not installed
      </Badge>
    );
  }
  if (status === "authenticated") {
    return (
      <Badge variant="outline" className="gap-1 border-green-500/50 text-green-600">
        <CheckCircle2 className="h-3 w-3" /> Authenticated
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 border-yellow-500/50 text-yellow-600">
      <XCircle className="h-3 w-3" /> Not authenticated
    </Badge>
  );
}

export function Models() {
  const queryClient = useQueryClient();
  const [activeAuth, setActiveAuth] = useState<string | null>(null);

  const { data: statusData, isLoading } = useQuery({
    queryKey: ["models", "status"],
    queryFn: () => modelsApi.getStatus(),
    refetchInterval: activeAuth ? 3000 : false,
  });

  const workspaceMutation = useMutation({
    mutationFn: () => modelsApi.initWorkspace(),
  });

  const statuses = statusData?.statuses ?? {};

  function handleAuthComplete() {
    setActiveAuth(null);
    void queryClient.invalidateQueries({ queryKey: ["models", "status"] });
  }

  return (
    <div className="p-6 max-w-2xl flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold">Models & Onboarding</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Check LLM CLI authentication status and initialize the agent workspace.
        </p>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          LLM CLI Authentication
        </h2>
        <div className="flex flex-col gap-3">
          {CLI_TOOLS.map((tool) => {
            const status = statuses[tool.id];
            const isActive = activeAuth === tool.id;
            const canConnect = status === "unauthenticated";

            return (
              <div key={tool.id} className="rounded-lg border border-border p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Cpu className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">{tool.label}</div>
                      <div className="text-xs text-muted-foreground">{tool.description}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                      <StatusBadge status={status} />
                    )}
                    {canConnect && !isActive && (
                      <Button variant="outline" size="sm" onClick={() => setActiveAuth(tool.id)}>
                        Login
                      </Button>
                    )}
                    {isActive && (
                      <Button variant="ghost" size="sm" onClick={() => setActiveAuth(null)}>
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>

                {isActive && (
                  <CliAuthTerminal cliName={tool.id} onComplete={handleAuthComplete} />
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Agent Workspace
        </h2>
        <div className="rounded-lg border border-border p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FolderOpen className="h-5 w-5 text-muted-foreground" />
            <div>
              <div className="text-sm font-medium">Initialize Workspace</div>
              <div className="text-xs text-muted-foreground">
                Create ~/workspace, ~/workspace/agents, ~/workspace/docs + AGENTS.md template
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {workspaceMutation.isSuccess && (
              <Badge variant="outline" className="gap-1 border-green-500/50 text-green-600">
                <CheckCircle2 className="h-3 w-3" />
                {workspaceMutation.data?.result.alreadyExisted ? "Already existed" : "Done"}
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => workspaceMutation.mutate()}
              disabled={workspaceMutation.isPending}
            >
              {workspaceMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Initialize"
              )}
            </Button>
          </div>
        </div>
        {workspaceMutation.isSuccess && (
          <div className="mt-2 rounded-md bg-muted/30 px-3 py-2 text-xs font-mono text-muted-foreground">
            {workspaceMutation.data?.result.workspaceDir}
          </div>
        )}
      </section>
    </div>
  );
}
