import { motion } from "framer-motion";
import { Plus, Search, UserCog } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const Users = () => {
  // Mock data
  const users = [
    { id: 1, name: "John Smith", email: "john@example.com", role: "PM", status: "Active", projects: 2 },
    { id: 2, name: "Sarah Johnson", email: "sarah@example.com", role: "Manager", status: "Active", projects: 5 },
    { id: 3, name: "Mike Chen", email: "mike@example.com", role: "Client", status: "Active", projects: 3 },
    { id: 4, name: "Emily Davis", email: "emily@example.com", role: "PM", status: "Active", projects: 1 },
    { id: 5, name: "Robert Wilson", email: "robert@example.com", role: "Client", status: "Inactive", projects: 0 },
  ];

  const getRoleBadgeColor = (role: string) => {
    const colors = {
      Admin: "bg-red-500/10 text-red-500",
      Manager: "bg-blue-500/10 text-blue-500",
      PM: "bg-green-500/10 text-green-500",
      Client: "bg-purple-500/10 text-purple-500",
    };
    return colors[role as keyof typeof colors] || "bg-gray-500/10 text-gray-500";
  };

  return (
    <div className="min-h-screen bg-background p-6 lg:p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto"
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">User Management</h1>
            <p className="text-muted-foreground">Manage all system users and roles</p>
          </div>
          <Button size="lg" className="gap-2">
            <Plus className="w-4 h-4" />
            Add User
          </Button>
        </div>

        {/* Search and Filters */}
        <GlassCard className="mb-6">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search users by name or email..."
                className="pl-10"
              />
            </div>
            <Button variant="outline">Filter</Button>
          </div>
        </GlassCard>

        {/* Users Table */}
        <GlassCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Projects</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell className="text-muted-foreground">{user.email}</TableCell>
                  <TableCell>
                    <Badge className={getRoleBadgeColor(user.role)}>
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.status === "Active" ? "default" : "secondary"}>
                      {user.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{user.projects}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">
                      <UserCog className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </GlassCard>
      </motion.div>
    </div>
  );
};

export default Users;
