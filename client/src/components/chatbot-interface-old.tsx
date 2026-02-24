import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Send, X, Minimize2 } from "lucide-react";
import { ChatMessage, ChatSession } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import SnykLogo from "@/components/snyk-logo";



export default function ChatbotInterface() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Chat mutation
  const chatMutation = useMutation({
    mutationFn: async ({
      message,
      sessionId,
    }: {
      message: string;
      sessionId?: string;
    }) => {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, sessionId }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Chat failed");
      }
      return response.json() as Promise<ChatSession>;
    },
    onSuccess: (data) => {
      setSessionId(data.sessionId);
      setMessage("");
    },
    onError: (error: Error) => {
      toast({
        title: "Chat error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = () => {
    if (!message.trim()) return;
    chatMutation.mutate({ message: message.trim(), sessionId: sessionId || undefined });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const messages = chatMutation.data?.messages || [];

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Chat Toggle Button */}
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          className="w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all transform hover:scale-105 p-0"
          data-testid="button-open-chat"
        >
          <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center doberman-icon">
            <SnykLogo className="text-blue-600" size={20} />
          </div>
        </Button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <Card className="w-96 h-96 shadow-2xl border border-gray-200 flex flex-col">
          {/* Chat Header */}
          <CardHeader className="bg-blue-600 text-white rounded-t-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center doberman-icon">
                  <SnykLogo className="text-blue-600" size={16} />
                </div>
                <div>
                  <h4 className="font-medium" data-testid="text-chat-title">Security Analyst</h4>
                  <p className="text-gray-100 text-xs">Powered by AI</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                  className="text-gray-100 hover:text-white hover:bg-gray-600 p-1 h-auto"
                  data-testid="button-minimize-chat"
                >
                  <Minimize2 className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                  className="text-gray-100 hover:text-white hover:bg-gray-600 p-1 h-auto"
                  data-testid="button-close-chat"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>

          {/* Chat Messages */}
          <CardContent className="flex-1 p-4 overflow-y-auto space-y-3">
            {messages.length === 0 && (
              <div className="flex items-start space-x-2">
                <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <SnykLogo className="w-3 h-3 text-white" />
                </div>
                <div className="bg-gray-100 rounded-lg p-3 max-w-xs">
                  <p className="text-sm text-gray-800" data-testid="text-welcome-message">
                    Hello! I'm your AI security analyst. I can help you understand your audit logs, 
                    identify patterns, and answer questions about security events.
                  </p>
                </div>
              </div>
            )}

            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex items-start space-x-2 ${
                  msg.role === "user" ? "justify-end" : ""
                }`}
                data-testid={`message-${index}`}
              >
                {msg.role === "assistant" && (
                  <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <SnykLogo className="w-3 h-3 text-white" />
                  </div>
                )}
                <div
                  className={`rounded-lg p-3 max-w-xs ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  <p className="text-sm">{msg.content}</p>
                  <p className="text-xs opacity-70 mt-1">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}

            {chatMutation.isPending && (
              <div className="flex items-start space-x-2">
                <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <SnykLogo className="w-3 h-3 text-white" />
                </div>
                <div className="bg-gray-100 rounded-lg p-3 max-w-xs">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>

          {/* Chat Input */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center space-x-2">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask about your audit logs..."
                className="flex-1"
                disabled={chatMutation.isPending}
                data-testid="input-chat-message"
              />
              <Button
                onClick={handleSendMessage}
                disabled={!message.trim() || chatMutation.isPending}
                className="bg-blue-600 text-white hover:bg-blue-700 p-2"
                data-testid="button-send-message"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-2" data-testid="text-chat-disclaimer">
              AI can analyze patterns, security risks, and provide insights from your audit data.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}