import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Send, X, Minimize2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import SnykLogo from "@/components/snyk-logo";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export default function ChatbotInterface() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);

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

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Chat Toggle Button */}
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          className="w-14 h-14 bg-purple-600 text-white rounded-full shadow-lg hover:bg-purple-700 transition-all transform hover:scale-105 p-0"
          data-testid="button-open-chat"
        >
          <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
            <SnykLogo className="text-purple-600" size={20} />
          </div>
        </Button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <Card className="w-96 h-96 shadow-2xl border border-gray-200 flex flex-col">
          {/* Chat Header */}
          <CardHeader className="bg-purple-600 text-white rounded-t-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                  <SnykLogo className="text-purple-600" size={16} />
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
          <CardContent className="flex-1 p-0 overflow-hidden">
            <div className="h-full flex flex-col">
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                  <div className="text-center text-gray-500 mt-8">
                    <SnykLogo className="text-blue-600 mx-auto mb-3" size={32} />
                    <p className="text-sm">Ask me about your audit logs!</p>
                    <p className="text-xs mt-1">I can help analyze security events and provide insights.</p>
                  </div>
                ) : (
                  messages.map((msg, index) => (
                    <div key={index} className={`flex items-start space-x-2 chat-message ${msg.role === "user" ? "justify-end" : ""}`}>
                      {msg.role === "assistant" && (
                        <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                          <SnykLogo className="text-white" size={12} />
                        </div>
                      )}
                      <div className={`max-w-xs p-3 rounded-lg ${msg.role === "user" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-800"}`}>
                        <p className="text-sm">{msg.content}</p>
                      </div>
                      {msg.role === "user" && (
                        <div className="w-6 h-6 bg-gray-400 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-xs font-medium">U</span>
                        </div>
                      )}
                    </div>
                  ))
                )}
                
                {chatMutation.isPending && (
                  <div className="flex items-start space-x-2">
                    <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <SnykLogo className="text-white" size={12} />
                    </div>
                    <div className="bg-gray-100 p-3 rounded-lg">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Input */}
              <div className="border-t p-4">
                <div className="flex space-x-2">
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
                    className="bg-purple-600 text-white hover:bg-purple-700 p-2"
                    data-testid="button-send-message"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}