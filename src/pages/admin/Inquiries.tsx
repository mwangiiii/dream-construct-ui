import { motion } from "framer-motion";
import { Mail, MessageSquare, Clock } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const Inquiries = () => {
  // Mock data
  const inquiries = [
    {
      id: 1,
      name: "Alice Cooper",
      email: "alice@example.com",
      subject: "Project Quote Request",
      message: "I'm interested in getting a quote for a residential construction project...",
      status: "New",
      date: "2 hours ago",
    },
    {
      id: 2,
      name: "Bob Miller",
      email: "bob@example.com",
      subject: "Commercial Building Inquiry",
      message: "Looking to discuss a large commercial building project in downtown...",
      status: "Replied",
      date: "1 day ago",
    },
    {
      id: 3,
      name: "Carol White",
      email: "carol@example.com",
      subject: "Industrial Renovation",
      message: "Need information about industrial facility renovation services...",
      status: "In Progress",
      date: "3 days ago",
    },
  ];

  const getStatusColor = (status: string) => {
    const colors = {
      New: "bg-green-500/10 text-green-500",
      Replied: "bg-blue-500/10 text-blue-500",
      "In Progress": "bg-yellow-500/10 text-yellow-500",
    };
    return colors[status as keyof typeof colors];
  };

  return (
    <div className="min-h-screen bg-background p-6 lg:p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto"
      >
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Inquiries Management</h1>
          <p className="text-muted-foreground">View and respond to customer inquiries</p>
        </div>

        {/* Inquiries List */}
        <div className="space-y-4">
          {inquiries.map((inquiry, idx) => (
            <motion.div
              key={inquiry.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
            >
              <GlassCard>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-primary/10">
                      <MessageSquare className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg mb-1">{inquiry.subject}</h3>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground mb-2">
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {inquiry.email}
                        </span>
                        <span>•</span>
                        <span>{inquiry.name}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {inquiry.date}
                        </span>
                      </div>
                      <p className="text-muted-foreground">{inquiry.message}</p>
                    </div>
                  </div>
                  <Badge className={getStatusColor(inquiry.status)}>
                    {inquiry.status}
                  </Badge>
                </div>
                <div className="flex gap-2 pt-4 border-t border-border">
                  <Button variant="outline" size="sm">View Details</Button>
                  <Button size="sm">Reply</Button>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default Inquiries;
