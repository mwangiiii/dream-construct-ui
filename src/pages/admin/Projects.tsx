import { motion } from "framer-motion";
import { Plus, Search } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const Projects = () => {
  // Mock data
  const projects = [
    {
      id: 1,
      name: "Skyline Tower",
      client: "Acme Corp",
      manager: "Sarah Johnson",
      pm: "John Smith",
      progress: 45,
      status: "Active",
      startDate: "Jan 2024",
    },
    {
      id: 2,
      name: "Harbor Bridge",
      client: "City Council",
      manager: "Sarah Johnson",
      pm: "Emily Davis",
      progress: 78,
      status: "Active",
      startDate: "Mar 2024",
    },
    {
      id: 3,
      name: "Tech Campus",
      client: "Innovation Labs",
      manager: "Mike Chen",
      pm: "John Smith",
      progress: 92,
      status: "Near Completion",
      startDate: "Nov 2023",
    },
  ];

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
            <h1 className="text-4xl font-bold mb-2">Project Management</h1>
            <p className="text-muted-foreground">Create and manage construction projects</p>
          </div>
          <Button size="lg" className="gap-2">
            <Plus className="w-4 h-4" />
            Create Project
          </Button>
        </div>

        {/* Search */}
        <GlassCard className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search projects..."
              className="pl-10"
            />
          </div>
        </GlassCard>

        {/* Projects Table */}
        <GlassCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project Name</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Manager</TableHead>
                <TableHead>PM</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((project) => (
                <TableRow key={project.id}>
                  <TableCell className="font-medium">{project.name}</TableCell>
                  <TableCell className="text-muted-foreground">{project.client}</TableCell>
                  <TableCell className="text-muted-foreground">{project.manager}</TableCell>
                  <TableCell className="text-muted-foreground">{project.pm}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 min-w-[120px]">
                      <Progress value={project.progress} className="h-2" />
                      <span className="text-sm font-medium">{project.progress}%</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={project.status === "Active" ? "default" : "secondary"}>
                      {project.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{project.startDate}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">Edit</Button>
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

export default Projects;
