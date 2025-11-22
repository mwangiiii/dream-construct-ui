import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, Search, UserCog } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  phone: string | null;
}

const Users = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();
  const { session } = useAuth();

  const [newUser, setNewUser] = useState({
    email: "",
    fullName: "",
    role: "client" as "admin" | "manager" | "project_manager" | "client",
    phone: "",
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, phone");

      if (profilesError) throw profilesError;

      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      // Get emails from auth.users metadata
      const usersWithRoles: User[] = [];
      
      for (const profile of profilesData) {
        const userRole = rolesData.find((r: any) => r.user_id === profile.id);
        
        // Try to get email from auth API (admin only)
        try {
          const { data: { user }, error } = await supabase.auth.admin.getUserById(profile.id);
          if (!error && user) {
            usersWithRoles.push({
              id: profile.id,
              email: user.email || "",
              full_name: profile.full_name,
              role: userRole?.role || "client",
              phone: profile.phone,
            });
          }
        } catch (err) {
          console.error("Error fetching user email:", err);
        }
      }

      setUsers(usersWithRoles);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      toast({
        title: "Error",
        description: "Failed to fetch users",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      const { error } = await supabase.functions.invoke("create-user", {
        body: newUser,
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `User created successfully. Credentials have been sent to ${newUser.email}`,
      });

      setIsDialogOpen(false);
      setNewUser({
        email: "",
        fullName: "",
        role: "client",
        phone: "",
      });
      fetchUsers();
    } catch (error: any) {
      console.error("Error creating user:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create user",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const filteredUsers = users.filter(
    (user) =>
      user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      admin: "bg-red-500/10 text-red-500",
      manager: "bg-blue-500/10 text-blue-500",
      project_manager: "bg-green-500/10 text-green-500",
      client: "bg-purple-500/10 text-purple-500",
    };
    return colors[role] || "bg-gray-500/10 text-gray-500";
  };

  const formatRole = (role: string) => {
    return role.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase());
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
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="gap-2">
                <Plus className="w-4 h-4" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
                <DialogDescription>
                  Create a new user account. An email with login credentials will be sent automatically.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    placeholder="user@example.com"
                    required
                    disabled={isCreating}
                  />
                </div>

                <div>
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    value={newUser.fullName}
                    onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
                    placeholder="John Doe"
                    required
                    disabled={isCreating}
                  />
                </div>

                <div>
                  <Label htmlFor="phone">Phone (Optional)</Label>
                  <Input
                    id="phone"
                    value={newUser.phone}
                    onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                    placeholder="+1234567890"
                    disabled={isCreating}
                  />
                </div>

                <div>
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={newUser.role}
                    onValueChange={(value: any) => setNewUser({ ...newUser, role: value })}
                    disabled={isCreating}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="client">Client</SelectItem>
                      <SelectItem value="project_manager">Project Manager</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button type="submit" className="w-full" disabled={isCreating}>
                  {isCreating ? "Creating User..." : "Create User"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <GlassCard className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search users by name or email..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </GlassCard>

        {/* Users Table */}
        <GlassCard>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading users...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.full_name}</TableCell>
                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                    <TableCell>
                      <Badge className={getRoleBadgeColor(user.role)}>
                        {formatRole(user.role)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{user.phone || "-"}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">
                        <UserCog className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </GlassCard>
      </motion.div>
    </div>
  );
};

export default Users;
