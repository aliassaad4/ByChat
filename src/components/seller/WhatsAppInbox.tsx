import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, MessageSquare, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  customer_phone: string;
  direction: "inbound" | "outbound";
  body: string;
  created_at: string;
}

interface Conversation {
  customer_phone: string;
  last_message: string;
  last_at: string;
  unread: number;
}

function formatTime(ts: string) {
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  return isToday
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString([], { day: "2-digit", month: "short" });
}

/** Extract clean text from message body — handles raw JSON like {"response":"..."} */
function cleanMessageBody(body: string): string {
  if (!body) return "";
  const trimmed = body.trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      return parsed.response ?? parsed.message ?? parsed.text ?? parsed.reply ?? trimmed;
    } catch { /* not valid JSON, return as-is */ }
  }
  return trimmed;
}

export function WhatsAppInbox({ sellerId }: { sellerId: string }) {
  const queryClient = useQueryClient();
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  /* ── Conversations list ── */
  const { data: conversations = [], isLoading: loadingConvs } = useQuery<Conversation[]>({
    queryKey: ["wa-conversations", sellerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_messages")
        .select("customer_phone, body, created_at")
        .eq("seller_id", sellerId)
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Group by customer_phone, keep latest message per customer
      const map = new Map<string, Conversation>();
      for (const row of (data ?? [])) {
        if (!map.has(row.customer_phone)) {
          map.set(row.customer_phone, {
            customer_phone: row.customer_phone,
            last_message:   row.body,
            last_at:        row.created_at,
            unread:         0,
          });
        }
      }
      return Array.from(map.values());
    },
    refetchInterval: 5000,
  });

  /* ── Messages for selected conversation ── */
  const { data: messages = [], isLoading: loadingMsgs } = useQuery<Message[]>({
    queryKey: ["wa-messages", sellerId, selectedPhone],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_messages")
        .select("id, customer_phone, direction, body, created_at")
        .eq("seller_id", sellerId)
        .eq("customer_phone", selectedPhone!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!selectedPhone,
    refetchInterval: 3000,
  });

  /* ── Realtime subscription ── */
  useEffect(() => {
    const channel = supabase
      .channel(`wa-inbox-${sellerId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "whatsapp_messages", filter: `seller_id=eq.${sellerId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["wa-conversations", sellerId] });
          queryClient.invalidateQueries({ queryKey: ["wa-messages", sellerId, selectedPhone] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [sellerId, selectedPhone, queryClient]);

  /* ── Auto-scroll to bottom when messages load ── */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ════ EMPTY STATE ════ */
  if (!loadingConvs && conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center space-y-3">
        <MessageSquare className="w-10 h-10 text-muted-foreground/40" />
        <p className="text-sm font-medium text-muted-foreground">No conversations yet</p>
        <p className="text-xs text-muted-foreground/60">
          When customers message your WhatsApp number, their chats will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-180px)] rounded-xl overflow-hidden border border-border glass-card">

      {/* ── LEFT: Conversation list ── */}
      <div className={cn(
        "w-full sm:w-72 shrink-0 border-r border-border flex flex-col",
        selectedPhone && "hidden sm:flex"
      )}>
        <div className="px-4 py-3 border-b border-border">
          <p className="text-sm font-semibold">Conversations</p>
          <p className="text-xs text-muted-foreground mt-0.5">{conversations.length} customer{conversations.length !== 1 ? "s" : ""}</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingConvs ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.customer_phone}
                onClick={() => setSelectedPhone(conv.customer_phone)}
                className={cn(
                  "w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors border-b border-border/50",
                  selectedPhone === conv.customer_phone && "bg-primary/10 border-l-2 border-l-primary"
                )}
              >
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-[#25D366]/20 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-[#25D366]">
                    {conv.customer_phone.slice(-2)}
                  </span>
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium truncate">{conv.customer_phone}</p>
                    <p className="text-[10px] text-muted-foreground shrink-0">{formatTime(conv.last_at)}</p>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{cleanMessageBody(conv.last_message)}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── RIGHT: Message thread ── */}
      <div className={cn(
        "flex-1 flex flex-col",
        !selectedPhone && "hidden sm:flex"
      )}>
        {!selectedPhone ? (
          <div className="flex-1 flex items-center justify-center text-center px-6">
            <div className="space-y-2">
              <MessageSquare className="w-8 h-8 text-muted-foreground/30 mx-auto" />
              <p className="text-sm text-muted-foreground">Select a conversation to view messages</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/20">
              <button
                className="sm:hidden p-1 rounded hover:bg-muted"
                onClick={() => setSelectedPhone(null)}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="w-8 h-8 rounded-full bg-[#25D366]/20 flex items-center justify-center">
                <span className="text-xs font-bold text-[#25D366]">{selectedPhone.slice(-2)}</span>
              </div>
              <div>
                <p className="text-sm font-semibold">{selectedPhone}</p>
                <p className="text-xs text-muted-foreground">WhatsApp</p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2" style={{ background: "hsl(var(--muted)/0.3)" }}>
              {loadingMsgs ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn("flex", msg.direction === "outbound" ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={cn(
                        "max-w-[75%] px-3 py-2 rounded-2xl text-sm shadow-sm",
                        msg.direction === "outbound"
                          ? "bg-[#25D366] text-white rounded-br-sm"
                          : "bg-card text-foreground rounded-bl-sm border border-border"
                      )}
                    >
                      <p className="leading-relaxed">{cleanMessageBody(msg.body)}</p>
                      <p className={cn(
                        "text-[10px] mt-1 text-right",
                        msg.direction === "outbound" ? "text-white/70" : "text-muted-foreground"
                      )}>
                        {formatTime(msg.created_at)}
                        {msg.direction === "outbound" && " · AI"}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
