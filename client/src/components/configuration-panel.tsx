import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Eye, EyeOff, ChevronDown, ChevronUp, Settings } from "lucide-react";
import { ApiConfiguration } from "@/lib/types";

interface ConfigurationPanelProps {
  config?: ApiConfiguration;
  onSave: (config: {
    snykApiToken: string;
    groupId?: string;
    orgId?: string;
    apiVersion?: string;
  }) => void;
  onClear?: () => void;
  isLoading: boolean;
  hasData?: boolean;
}

export default function ConfigurationPanel({
  config,
  onSave,
  onClear,
  isLoading,
  hasData = false,
}: ConfigurationPanelProps) {
  const [formData, setFormData] = useState({
    snykApiToken: "",
    groupId: "",
    orgId: "",
    apiVersion: "2024-10-15",
  });
  const [showToken, setShowToken] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    if (config) {
      setFormData({
        snykApiToken: "",
        groupId: config.groupId || "",
        orgId: config.orgId || "",
        apiVersion: config.apiVersion || "2024-10-15",
      });
    }
  }, [config]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.snykApiToken.trim()) return;
    
    onSave({
      snykApiToken: formData.snykApiToken.trim(),
      groupId: formData.groupId.trim() || undefined,
      orgId: formData.orgId.trim() || undefined,
      apiVersion: formData.apiVersion.trim() || "2024-10-15",
    });
  };

  const isValid = formData.snykApiToken.trim().length > 0;

  // Auto-collapse when data is loaded and not currently loading
  useEffect(() => {
    if (hasData && !isLoading) {
      setIsCollapsed(true);
    }
  }, [hasData, isLoading]);

  return (
    <Card className="mb-8">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-purple-600" />
              <CardTitle className="text-lg font-semibold text-snyk-text" data-testid="text-config-title">
                API Configuration
              </CardTitle>
            </div>
            {hasData && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="text-gray-500 hover:text-gray-700"
                data-testid="button-toggle-config"
              >
                {isCollapsed ? (
                  <>
                    <ChevronDown className="w-4 h-4 mr-1" />
                    Show
                  </>
                ) : (
                  <>
                    <ChevronUp className="w-4 h-4 mr-1" />
                    Hide
                  </>
                )}
              </Button>
            )}
          </div>
          {!isCollapsed && (
            <div className="flex items-center gap-2">
              {!hasData && (
                <p className="text-sm text-gray-600" data-testid="text-config-description">
                  Configure your Snyk API credentials
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  onClick={handleSubmit}
                  disabled={!isValid || isLoading}
                  className="bg-purple-600 text-white hover:bg-purple-700 flex items-center gap-2"
                  data-testid="button-save-config"
                >
                  <Save className="w-4 h-4" />
                  <span>{isLoading ? "Fetching..." : "Fetch Audit Data"}</span>
                </Button>
                
                {hasData && (
                  <Button
                    type="button"
                    onClick={async () => {
                      try {
                        const response = await fetch('/api/config/clear', { 
                          method: 'POST', 
                          credentials: 'include' 
                        });
                        
                        if (!response.ok) {
                          throw new Error('Failed to clear configuration');
                        }
                        
                        // Clear form data
                        setFormData({
                          snykApiToken: "",
                          groupId: "",
                          orgId: "",
                          apiVersion: "2024-10-15",
                        });
                        
                        // Trigger refresh by calling onClear
                        if (onClear) {
                          onClear();
                        }
                        
                        // Force component to re-render by collapsing the panel
                        setIsCollapsed(false);
                        
                      } catch (error) {
                        console.error('Clear configuration error:', error);
                        // Still try to clear the local state even if the server call failed
                        setFormData({
                          snykApiToken: "",
                          groupId: "",
                          orgId: "",
                          apiVersion: "2024-10-15",
                        });
                        if (onClear) {
                          onClear();
                        }
                      }
                    }}
                    variant="outline"
                    className="text-red-600 border-red-300 hover:bg-red-50"
                    data-testid="button-clear-config"
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>
          )}
          {isCollapsed && hasData && (
            <div className="flex items-center gap-2 text-sm text-gray-500" data-testid="text-config-status">
              <span>✓ Configured</span>
              {config?.expiresInMinutes && (
                <span className="text-orange-600">
                  (expires in {config.expiresInMinutes}m)
                </span>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      {!isCollapsed && (
        <CardContent>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div>
            <Label htmlFor="api-token" className="block text-sm font-medium text-snyk-text mb-2">
              Snyk API Token <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Input
                id="api-token"
                type={showToken ? "text" : "password"}
                placeholder="Enter your Snyk API token"
                value={formData.snykApiToken}
                onChange={(e) =>
                  setFormData({ ...formData, snykApiToken: e.target.value })
                }
                className="pr-10"
                data-testid="input-api-token"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                data-testid="button-toggle-token"
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Required for API authentication
            </p>
          </div>

          <div>
            <Label htmlFor="group-id" className="block text-sm font-medium text-snyk-text mb-2">
              Group ID
            </Label>
            <Input
              id="group-id"
              type="text"
              placeholder="0d3728ec-eebf-484d-9907-ba238019f10b"
              value={formData.groupId}
              onChange={(e) =>
                setFormData({ ...formData, groupId: e.target.value })
              }
              data-testid="input-group-id"
            />
            <p className="text-xs text-gray-500 mt-1">
              For group-level audit logs
            </p>
          </div>

          <div>
            <Label htmlFor="org-id" className="block text-sm font-medium text-snyk-text mb-2">
              Organization ID
            </Label>
            <Input
              id="org-id"
              type="text"
              placeholder="0d3728ec-eebf-484d-9907-ba238019f10b"
              value={formData.orgId}
              onChange={(e) =>
                setFormData({ ...formData, orgId: e.target.value })
              }
              data-testid="input-org-id"
            />
            <p className="text-xs text-gray-500 mt-1">
              For organization-level audit logs
            </p>
          </div>

          <div>
            <Label htmlFor="api-version" className="block text-sm font-medium text-snyk-text mb-2">
              API Version
            </Label>
            <Input
              id="api-version"
              type="text"
              placeholder="2024-10-15"
              value={formData.apiVersion}
              onChange={(e) =>
                setFormData({ ...formData, apiVersion: e.target.value })
              }
              data-testid="input-api-version"
            />
            <p className="text-xs text-gray-500 mt-1">
              Snyk REST API version (format: YYYY-MM-DD, e.g., 2024-10-15)
            </p>
          </div>
        </form>
        </CardContent>
      )}
    </Card>
  );
}