import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, MessageCircle, Download, Copy, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import SnykLogo from "@/components/snyk-logo";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatMessage {
  role: "user" | "assistant" | "executive";
  content: string;
  timestamp: Date;
  isExecutiveSummary?: boolean;
}

interface ChatbotSectionProps {
  shouldGenerateSummary?: boolean;
  onSummaryGenerated?: () => void;
}

export default function ChatbotSection({ shouldGenerateSummary, onSummaryGenerated }: ChatbotSectionProps) {
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  // Executive summary generation
  const summaryMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/executive-summary");
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Summary generation failed");
      }
      return response.json();
    },
    onSuccess: (data) => {
      const summaryMessage: ChatMessage = {
        role: "executive",
        content: data.summary,
        timestamp: new Date(),
        isExecutiveSummary: true
      };
      setMessages([summaryMessage]);
      setIsGeneratingSummary(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Summary Generation Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Chat request failed");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: data.response,
          timestamp: new Date()
        }
      ]);
    },
    onError: (error: Error) => {
      toast({
        title: "Chat Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Auto-generate summary when audit data is fetched
  useEffect(() => {
    if (shouldGenerateSummary && !summaryMutation.isPending) {
      setIsGeneratingSummary(true);
      summaryMutation.mutate();
      // Reset the trigger immediately to prevent re-fetching
      onSummaryGenerated?.();
    }
  }, [shouldGenerateSummary]);

  const handleSendMessage = () => {
    if (!message.trim()) return;
    
    const userMessage: ChatMessage = {
      role: "user",
      content: message.trim(),
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    chatMutation.mutate(message.trim());
    setMessage("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleDownloadSummary = () => {
    const summaryMessage = messages.find(msg => msg.isExecutiveSummary);
    if (summaryMessage) {
      const blob = new Blob([summaryMessage.content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `snyk-executive-summary-${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Summary Downloaded",
        description: "Executive summary has been saved to your downloads.",
      });
    }
  };

  const handleCopySummary = async () => {
    const summaryMessage = messages.find(msg => msg.isExecutiveSummary);
    if (summaryMessage) {
      try {
        await navigator.clipboard.writeText(summaryMessage.content);
        toast({
          title: "Summary Copied",
          description: "Executive summary has been copied to your clipboard.",
        });
      } catch (error) {
        toast({
          title: "Copy Failed",
          description: "Unable to copy to clipboard. Please try manually selecting the text.",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <Card className="mb-8">
      <CardHeader className="bg-purple-600 text-white">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
            <SnykLogo className="text-purple-600" size={20} />
          </div>
          <div>
            <CardTitle className="text-lg font-semibold" data-testid="text-chat-title">
              Security Analyst AI
            </CardTitle>
            <p className="text-purple-100 text-sm">
              Ask questions about your audit logs • Powered by AI
            </p>
          </div>

        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* Chat Messages */}
        <ScrollArea className="h-96 p-4">
          {messages.length === 0 && !summaryMutation.isPending ? (
            <div className="text-center text-gray-500 mt-12">
              <SnykLogo className="text-purple-600 mx-auto mb-4" size={48} />
              <h3 className="text-lg font-medium mb-2">Welcome to Security Analysis</h3>
              <p className="text-sm mb-4">Ask me about your audit logs and I'll provide security insights!</p>
              <div className="grid grid-cols-1 gap-2 max-w-md mx-auto text-xs">
                <div className="bg-gray-50 p-3 rounded-lg text-left">
                  <strong>Example:</strong> "What critical security events happened this week?"
                </div>
                <div className="bg-gray-50 p-3 rounded-lg text-left">
                  <strong>Example:</strong> "Analyze service account activities"
                </div>
                <div className="bg-gray-50 p-3 rounded-lg text-left">
                  <strong>Example:</strong> "Show me user permission changes"
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg, index) => (
                <div key={index} className={`flex items-start space-x-3 ${msg.role === "user" ? "justify-end" : ""}`}>
                  {(msg.role === "assistant" || msg.role === "executive") && (
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      msg.role === "executive" ? "bg-purple-600" : "bg-purple-600"
                    }`}>
                      {msg.role === "executive" ? (
                        <FileText className="text-white" size={16} />
                      ) : (
                        <SnykLogo className="text-white" size={16} />
                      )}
                    </div>
                  )}
                  <div className={`max-w-3xl rounded-lg ${
                    msg.role === "user" 
                      ? "bg-purple-600 text-white ml-12 p-4" 
                      : msg.role === "executive"
                      ? "bg-purple-50 border border-purple-200 text-gray-800 mr-12 p-4"
                      : "bg-gray-50 text-gray-800 mr-12 p-4"
                  }`}>
                    {msg.role === "executive" && (
                      <div className="flex justify-between items-center mb-3 pb-2 border-b border-purple-200">
                        <div className="flex items-center space-x-2">
                          <FileText className="w-4 h-4 text-purple-600" />
                          <span className="font-semibold text-purple-800">Executive Summary - Last 24 Hours</span>
                        </div>
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleCopySummary}
                            className="h-7 text-xs border-purple-300 hover:bg-purple-50"
                            data-testid="button-copy-summary"
                          >
                            <Copy className="w-3 h-3 mr-1" />
                            Copy
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleDownloadSummary}
                            className="h-7 text-xs border-purple-300 hover:bg-purple-50"
                            data-testid="button-download-summary"
                          >
                            <Download className="w-3 h-3 mr-1" />
                            Download
                          </Button>
                        </div>
                      </div>
                    )}
                    <div className="text-sm">
                      {msg.isExecutiveSummary ? (
                        <div className="executive-summary-content space-y-4">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              h1: ({children}) => <h1 className="text-xl font-bold text-purple-800 mb-3 border-b border-purple-200 pb-2">{children}</h1>,
                              h2: ({children}) => <h2 className="text-lg font-semibold text-purple-800 mb-2 mt-4">{children}</h2>,
                              h3: ({children}) => <h3 className="text-base font-medium text-purple-700 mb-2 mt-3">{children}</h3>,
                              h4: ({children}) => <h4 className="text-sm font-medium text-purple-700 mb-1 mt-2">{children}</h4>,
                              p: ({children}) => <p className="text-gray-700 leading-relaxed mb-2">{children}</p>,
                              ul: ({children}) => <ul className="list-disc list-inside text-gray-700 space-y-1 ml-2">{children}</ul>,
                              ol: ({children}) => <ol className="list-decimal list-inside text-gray-700 space-y-1 ml-2">{children}</ol>,
                              li: ({children}) => <li className="text-gray-700">{children}</li>,
                              strong: ({children}) => <strong className="font-semibold text-gray-900">{children}</strong>,
                              em: ({children}) => <em className="italic text-gray-600">{children}</em>,
                              code: ({children}) => <code className="bg-purple-50 text-purple-800 px-1 py-0.5 rounded text-xs font-mono">{children}</code>,
                              blockquote: ({children}) => <blockquote className="border-l-4 border-purple-200 pl-4 italic text-gray-600 bg-purple-50 py-2">{children}</blockquote>
                            }}
                          >
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                      )}
                    </div>
                    <div className={`text-xs mt-2 ${
                      msg.role === "user" ? "text-purple-200" : 
                      msg.role === "executive" ? "text-purple-600" : "text-gray-500"
                    }`}>
                      {msg.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                  {msg.role === "user" && (
                    <div className="w-8 h-8 bg-gray-400 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-sm font-medium">U</span>
                    </div>
                  )}
                </div>
              ))}
              
              {(chatMutation.isPending || summaryMutation.isPending) && (
                <div className="flex items-start space-x-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    summaryMutation.isPending ? "bg-purple-600" : "bg-purple-600"
                  }`}>
                    {summaryMutation.isPending ? (
                      <FileText className="text-white" size={16} />
                    ) : (
                      <SnykLogo className="text-white" size={16} />
                    )}
                  </div>
                  <div className={`p-4 rounded-lg mr-12 ${
                    summaryMutation.isPending ? "bg-green-50 border border-green-200" : "bg-gray-50"
                  }`}>
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                    </div>
                    <div className={`text-xs mt-2 ${
                      summaryMutation.isPending ? "text-green-600" : "text-gray-500"
                    }`}>
                      {summaryMutation.isPending ? "Generating executive summary..." : "Analyzing your audit logs..."}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Chat Input */}
        <div className="border-t p-4 bg-gray-50">
          <div className="flex space-x-3">
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask about your audit logs... (e.g., 'What critical events happened today?')"
              className="flex-1"
              disabled={chatMutation.isPending}
              data-testid="input-chat-message"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!message.trim() || chatMutation.isPending || summaryMutation.isPending}
              className="bg-purple-600 text-white hover:bg-purple-700"
              data-testid="button-send-message"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}