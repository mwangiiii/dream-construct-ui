// src/pages/client/clientNotifications.tsx
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentUser, AuthUser } from "@/lib/auth";
import { motion } from "framer-motion";
import { Bell, Home } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";

interface Notification {
  id: string;
  message: string;
  created_at: string;
  read: boolean;
}

export default function ClientNotifications() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentUser().then(user => {
      setCurrentUser(user);
      if (user) fetchNotifications(user.profile.id);
      else setLoading(false);
    });
  }, []);

  const fetchNotifications = async (clientId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("notifications")
      .select("id, message, created_at, read")
      .eq("user_id", clientId)
      .order("created_at", { ascending: false });
    if (error) {
      setLoading(false);
      return;
    }
    setNotifications(data || []);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-background/95 via-background/98 to-background">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
          <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-xl text-muted-foreground">Loading notifications...</div>
        </motion.div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-background/95 via-background/98 to-background">
        <GlassCard className="p-12 text-center max-w-md">
          <Home className="w-16 h-16 text-primary/50 mx-auto mb-4" />
          <div className="text-xl font-semibold mb-2">Sign in required</div>
          <p className="text-muted-foreground">Please log in to view your notifications.</p>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background/95 via-background/98 to-background">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="glass-strong border-b border-white/10">
        <div className="px-2 sm:px-4 lg:px-8 py-6 sm:py-8 flex items-center gap-4">
          <Bell className="w-8 h-8 text-primary" />
          <h1 className="text-4xl md:text-5xl font-bold mb-0 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            Notifications
          </h1>
        </div>
      </motion.div>
      <div className="px-2 sm:px-4 lg:px-8 py-8">
        {notifications.length === 0 ? (
          <GlassCard className="p-12 max-w-md mx-auto text-center">
            <Bell className="w-20 h-20 text-primary/50 mx-auto mb-4" />
            <p className="text-xl font-semibold mb-2">No notifications</p>
            <p className="text-muted-foreground mb-6">You have no notifications at this time.</p>
          </GlassCard>
        ) : (
          <div className="space-y-4 max-w-2xl mx-auto">
            {notifications.map((notif) => (
              <GlassCard
                key={notif.id}
                className={`p-6 flex items-start gap-4 border-l-4 ${notif.read ? "border-muted-foreground" : "border-primary"}`}
              >
                <Bell className={`w-6 h-6 ${notif.read ? "text-muted-foreground" : "text-primary"}`} />
                <div className="flex-1">
                  <div className="font-medium text-foreground mb-1">{notif.message}</div>
                  <div className="text-xs text-muted-foreground">{new Date(notif.created_at).toLocaleString()}</div>
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
