import { useState, useRef, useEffect } from "react";
import { Bot, Send, X, Loader2, MapPin, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const N8N_WEBHOOK_URL = "https://bychat.app.n8n.cloud/webhook/ai-chat";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** If true, show a confirm order button */
  showConfirm?: boolean;
  confirmed?: boolean;
};

type Props = {
  agentName: string;
  storeName: string;
  sellerId: string;
  buyerId: string | null;
  buyerName: string;
  autoGreeting?: string;
  onClose?: () => void;
};

/** Detect order confirmation pattern from agent response */
function hasOrderSummary(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    (lower.includes("order") || lower.includes("total")) &&
    (lower.includes("confirm") || lower.includes("$") || lower.includes("usd"))
  );
}

export function ShopChatPanel({
  agentName,
  storeName,
  sellerId,
  buyerId,
  buyerName,
  autoGreeting,
  onClose,
}: Props) {
  const [sessionId] = useState(
    () => `${sellerId}_${buyerId || "guest"}_${Date.now()}`
  );

  const greeting =
    autoGreeting ||
    `Hi! I'm ${agentName} from ${storeName} 👋 How can I help you today?`;

  const [messages, setMessages] = useState<Message[]>([
    { id: "greeting", role: "assistant", content: greeting },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isLoading]);

  // Auto-focus input when chat opens and after each message
  useEffect(() => {
    if (!isLoading) {
      inputRef.current?.focus();
    }
  }, [isLoading, messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text.trim(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch(N8N_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seller_id: sellerId,
          buyer_id: buyerId || null,
          buyer_name: buyerName,
          message: userMsg.content,
          session_id: sessionId,
        }),
      });

      if (!response.ok) throw new Error("Network response error");

      const data = await response.json();
      const replyText =
        data.response || "Sorry, I couldn't process that. Please try again.";

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: replyText,
          showConfirm: hasOrderSummary(replyText),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content:
            "Sorry, I'm having trouble connecting right now. Please try again in a moment.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmOrder = async (msgId: string) => {
    // Mark as confirmed
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, confirmed: true, showConfirm: false } : m))
    );
    // Send confirmation message to the agent
    await sendMessage("✅ I confirm this order.");
  };

  const handleSendLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const locText = `📍 My location: https://www.google.com/maps?q=${pos.coords.latitude},${pos.coords.longitude}`;
        sendMessage(locText);
      },
      () => toast.error("Could not get your location"),
      { enableHighAccuracy: true }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background/95 backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-card/80">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-md">
          <Bot className="w-5 h-5 text-primary-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-tight">{agentName}</p>
          <p className="text-xs text-muted-foreground truncate">{storeName}</p>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] text-muted-foreground">Online</span>
        </div>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="shrink-0 rounded-full hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div className="flex flex-col gap-1.5 max-w-[85%]">
              {msg.role === "assistant" && (
                <span className="text-[10px] text-muted-foreground ml-1">{agentName}</span>
              )}
              <div
                className={`rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-muted text-foreground rounded-bl-sm"
                }`}
              >
                {msg.content}
              </div>

              {/* Order confirm button */}
              {msg.showConfirm && !msg.confirmed && (
                <Button
                  variant="hero"
                  size="sm"
                  className="self-start mt-1 gap-2"
                  onClick={() => handleConfirmOrder(msg.id)}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Confirm Order
                </Button>
              )}
              {msg.confirmed && (
                <div className="flex items-center gap-1.5 text-xs text-primary ml-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Order Confirmed
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0ms]" />
              <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:150ms]" />
              <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="px-3 py-3 border-t border-border bg-card/60">
        <div className="flex items-end gap-2">
          {/* Location button */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 rounded-full h-9 w-9 text-muted-foreground hover:text-primary"
            onClick={handleSendLocation}
            title="Send my location"
          >
            <MapPin className="w-4 h-4" />
          </Button>

          {/* Textarea instead of Input — fixes "locked" feel */}
          <textarea
            ref={inputRef}
            placeholder="Type a message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            className="flex-1 resize-none bg-muted/50 border border-border rounded-xl px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background disabled:opacity-50 max-h-24 overflow-y-auto"
            style={{ minHeight: "40px" }}
          />

          <Button
            type="button"
            size="icon"
            variant="hero"
            className="shrink-0 rounded-full h-9 w-9"
            disabled={!input.trim() || isLoading}
            onClick={() => sendMessage(input)}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
