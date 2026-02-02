import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ConfigurationPanel from "@/components/configuration-panel";
import FilterControls from "@/components/filter-controls";
import AuditLogTable from "@/components/audit-log-table";
import ChatbotSection from "@/components/chatbot-section";
import SnykLogo from "@/components/snyk-logo";
import { useToast } from "@/hooks/use-toast";
import { ApiConfiguration, AuditLogResponse } from "@/lib/types";
import logoPath from "@assets/LogSniffer (1)_1755105613864.png";

export default function AuditLogsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [filters, setFilters] = useState({
    from: "",
    to: "",
    events: [] as string[],
    excludeEvents: [] as string[],
    size: 50,
    search: "",
  });
  
  const [shouldGenerateSummary, setShouldGenerateSummary] = useState(false);

  // Configuration query
  const configQuery = useQuery<ApiConfiguration>({
    queryKey: ["/api/config"],
    retry: false,
  });

  // Configuration mutation
  const configMutation = useMutation({
    mutationFn: async (config: {
      snykApiToken: string;
      groupId?: string;
      orgId?: string;
      apiVersion?: string;
    }) => {
      const response = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Configuration failed");
      }
      return response.json() as Promise<ApiConfiguration>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/config"] });
      queryClient.invalidateQueries({ queryKey: ["/api/audit-logs"] });
      setShouldGenerateSummary(true);
      toast({
        title: "Configuration saved",
        description: "Your API configuration has been saved successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Configuration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Audit logs query
  const auditLogsQuery = useQuery<AuditLogResponse>({
    queryKey: ["/api/audit-logs", JSON.stringify(filters)],
    enabled: !!configQuery.data?.snykApiToken,
    retry: false,
    staleTime: 0, // Always refetch to get latest data
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.from) params.append("from", filters.from);
      if (filters.to) params.append("to", filters.to);
      if (filters.events.length) {
        filters.events.forEach(event => params.append("events", event));
      }
      if (filters.excludeEvents.length) {
        filters.excludeEvents.forEach(event => params.append("excludeEvents", event));
      }
      if (filters.search) params.append("search", filters.search);
      params.append("size", filters.size.toString());

      const response = await fetch(`/api/audit-logs?${params}`);
      if (!response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const error = await response.json();
          throw new Error(error.error || "Failed to fetch audit logs");
        } else {
          const text = await response.text();
          throw new Error(`Server error: ${response.status} - ${text.substring(0, 100)}`);
        }
      }
      return response.json() as Promise<AuditLogResponse>;
    }
  });

  // Audit logs fetch mutation
  const fetchLogsMutation = useMutation({
    mutationFn: async () => {
      const params = new URLSearchParams();
      if (filters.from) params.append("from", filters.from);
      if (filters.to) params.append("to", filters.to);
      if (filters.events.length) {
        filters.events.forEach(event => params.append("events", event));
      }
      if (filters.excludeEvents.length) {
        filters.excludeEvents.forEach(event => params.append("excludeEvents", event));
      }
      if (filters.search) params.append("search", filters.search);
      params.append("size", filters.size.toString());

      const response = await fetch(`/api/audit-logs?${params}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch audit logs");
      }
      return response.json() as Promise<AuditLogResponse>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/audit-logs"] });
      setShouldGenerateSummary(true);
      toast({
        title: "Logs fetched",
        description: "Audit logs have been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to fetch logs",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Export mutation
  const exportMutation = useMutation({
    mutationFn: async (format: "json" | "csv") => {
      const params = new URLSearchParams();
      if (filters.from) params.append("from", filters.from);
      if (filters.to) params.append("to", filters.to);
      if (filters.events.length) {
        filters.events.forEach(event => params.append("events", event));
      }
      if (filters.excludeEvents.length) {
        filters.excludeEvents.forEach(event => params.append("excludeEvents", event));
      }
      if (filters.search) params.append("search", filters.search);
      params.append("size", filters.size.toString());
      params.append("format", format);

      const response = await fetch(`/api/audit-logs/export?${params}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Export failed");
      }

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = `audit-logs.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onSuccess: (_, format) => {
      toast({
        title: "Export completed",
        description: `Audit logs exported as ${format.toUpperCase()} file.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Export failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFetchLogs = () => {
    fetchLogsMutation.mutate();
  };

  const handleExport = (format: "json" | "csv") => {
    exportMutation.mutate(format);
  };

  const config = configQuery.data as ApiConfiguration | undefined;
  const hasConfig = config?.snykApiToken;

  return (
    <div className="min-h-screen bg-snyk-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="text-4xl">🔍</div>
              <h1 className="text-3xl font-bold text-snyk-text" data-testid="text-page-title">
                Log Sniffer
              </h1>
            </div>
            <img 
              src={logoPath} 
              alt="LogSniffer Logo" 
              className="h-16 w-auto" 
              data-testid="img-logo"
            />
          </div>
          <p className="text-gray-600" data-testid="text-page-subtitle">
            Monitor and analyze your Snyk security audit events with AI-powered insights
          </p>
        </div>

        {/* Configuration Panel */}
        <ConfigurationPanel
          config={config}
          onSave={configMutation.mutate}
          onClear={() => {
            // Invalidate the config query to force refresh
            queryClient.invalidateQueries({ queryKey: ["/api/config"] });
            // Also invalidate audit logs
            queryClient.invalidateQueries({ queryKey: ["/api/audit-logs"] });
          }}
          isLoading={configMutation.isPending}
          hasData={hasConfig && !!(auditLogsQuery.data?.items?.length || fetchLogsMutation.data?.items?.length)}
        />

        {/* Security Analyst Chatbot */}
        {hasConfig && (
          <ChatbotSection 
            shouldGenerateSummary={shouldGenerateSummary}
            onSummaryGenerated={() => setShouldGenerateSummary(false)}
          />
        )}

        {/* Main Content */}
        {hasConfig && (
          <>
            <FilterControls
              filters={filters}
              onFiltersChange={setFilters}
              onFetch={handleFetchLogs}
              onExport={handleExport}
              isLoading={fetchLogsMutation.isPending || auditLogsQuery.isLoading}
              isExporting={exportMutation.isPending}
            />

            <AuditLogTable
              data={(auditLogsQuery.data || fetchLogsMutation.data) as AuditLogResponse | undefined}
              isLoading={fetchLogsMutation.isPending || auditLogsQuery.isLoading}
              error={auditLogsQuery.error as Error || fetchLogsMutation.error as Error}
              onRefresh={handleFetchLogs}
              searchTerm={filters.search}
            />
          </>
        )}

        {/* Configuration Required State */}
        {!hasConfig && !configQuery.isLoading && (
          <div className="mt-12 text-center">
            <div className="bg-white rounded-lg border border-gray-200 p-8 max-w-md mx-auto">
              <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <SnykLogo className="text-white" size={32} />
              </div>
              <h3 className="text-lg font-semibold text-snyk-text mb-2" data-testid="text-setup-title">
                Setup Required
              </h3>
              <p className="text-gray-600 mb-4" data-testid="text-setup-message">
                Configure your Snyk API credentials above to start viewing audit logs and get AI-powered security insights.
              </p>
              <p className="text-sm text-gray-500">
                Once configured, you'll be able to:
              </p>
              <ul className="text-sm text-gray-500 mt-2 space-y-1">
                <li>• View real-time audit events</li>
                <li>• Filter and search log data</li>
                <li>• Get AI security analysis</li>
                <li>• Export data in multiple formats</li>
              </ul>
            </div>
          </div>
        )}


      </div>
    </div>
  );
}