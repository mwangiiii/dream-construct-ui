import { motion } from "framer-motion";
import { Target, Heart, Award, Users, Clock, User } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GlassCard } from "@/components/ui/GlassCard";
import { supabase } from "@/lib/supabaseClient";
import { useEffect, useState } from "react";

interface TeamMember {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  job_title: string | null;
  role_name: string;
}

const Team = () => {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTeam = async () => {
      console.log("Team.tsx → Starting fetchTeam()");

      try {
        const { data: rawData, error, count, status } = await supabase
          .from("profiles")
          .select(
            `
            id,
            full_name,
            avatar_url,
            job_title,
            user_roles (
              role_name
            )
          `,
            { count: "exact" }
          )
          .in("user_roles.role_name", [
            "admin",
            "manager",
            "project_manager",   // ← CORRECT: underscore, matches your enum
            "finance",
            "surveyor"
          ])
          .order("full_name", { ascending: true });

        console.log("Raw Supabase response:", { rawData, error, count, status });

        if (error) {
          console.error("Supabase threw an error:", error);
          throw error;
        }

        if (!rawData || rawData.length === 0) {
          console.warn("No team members found. Possible reasons:");
          console.warn("• No users have admin/manager/project_manager/finance/surveyor roles");
          console.warn("• RLS blocks access to user_roles table");
          console.warn("• Roles are still saved as 'project manager' (with space)");
          setTeamMembers([]);
          return;
        }

        console.log("Found profiles with roles:", rawData);

        const members: TeamMember[] = rawData
          .map((profile: any) => {
            const roles = profile.user_roles || [];
            console.log(`User: ${profile.full_name} (ID: ${profile.id}) → Roles:`, roles);

            return roles
              .filter((r: any) =>
                ["admin", "manager", "project_manager", "finance", "surveyor"].includes(r.role_name)
              )
              .map((role: any) => ({
                id: profile.id,
                full_name: profile.full_name || "Unnamed Team Member",
                avatar_url: profile.avatar_url,
                job_title: profile.job_title || "Team Member",
                role_name: role.role_name,
              }));
          })
          .flat();

        console.log("FINAL TEAM MEMBERS ARRAY:", members);
        setTeamMembers(members);
      } catch (err: any) {
        console.error("fetchTeam() crashed:", err);
        console.error("Error message:", err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTeam();
  }, []);

  const getAvatarUrl = (path: string | null) => {
    if (!path) {
      console.log("No avatar path → using fallback icon");
      return null;
    }
    if (path.startsWith("http")) {
      console.log("Avatar is full URL:", path);
      return path;
    }
    console.log("Generating public URL for path:", path);
    const { data } = supabase.storage.from("profile-pictures").getPublicUrl(path);
    console.log("Generated public URL:", data.publicUrl);
    return data.publicUrl;
  };

  const values = [
    { icon: Target, title: "Quality", description: "We Pledge to deliver quality work from our qualified team." },
    { icon: Heart, title: "Integrity", description: "Honest communication and ethical practices form the foundation of all our relationships and work." },
    { icon: Clock, title: "Time", description: "Where We Deliver Our Work On Time, Every Time." },
    { icon: Award, title: "Innovation", description: "We Deliver Creative and Sustainable Solutions that Push the Boundaries of Traditional Construction for You." },
    { icon: Users, title: "Collaboration", description: "Working together with clients, partners, and teams to achieve extraordinary results." },
  ];

  return (
    <div className="min-h-screen pt-32 pb-20">
      <div className="container mx-auto px-6">
        {/* Company Overview */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto text-center mb-32">
          <h1 className="text-5xl md:text-7xl font-bold mb-6">
            About <span className="text-primary">Dream Construct</span>
          </h1>
          <p className="text-xl text-muted-foreground leading-relaxed mb-8">
            Dream Construct Limited is at the Forefront of Creative, Eco-friendly and Human-friendly Construction
            Excellence, Transforming Visions into Reality Through Innovation, expertise, and
            Unwavering Commitment to Quality and Time.
          </p>
        </motion.div>

        {/* Values */}
        <SectionHeading title="Our Values" subtitle="The principles that guide everything we do" className="mb-16" />
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-32">
          {values.map((value, idx) => (
            <motion.div key={value.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: idx * 0.1 }}>
              <GlassCard className="text-center h-full">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mx-auto mb-6">
                  <value.icon className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">{value.title}</h3>
                <p className="text-sm text-muted-foreground">{value.description}</p>
              </GlassCard>
            </motion.div>
          ))}
        </div>

        {/* Team Section */}
        <SectionHeading title="Meet Our Team" subtitle="Expert professionals dedicated to bringing your vision to life" className="mb-16" />

        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[...Array(6)].map((_, i) => (
              <GlassCard key={i} className="text-center animate-pulse">
                <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 mx-auto mb-6" />
                <div className="h-8 bg-muted rounded w-48 mx-auto mb-2 mt-4" />
                <div className="h-5 bg-muted rounded w-32 mx-auto" />
              </GlassCard>
            ))}
          </div>
        ) : teamMembers.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-2xl text-muted-foreground mb-4">No team members found.</p>
            <p className="text-sm text-muted-foreground">Open console (F12) → full debug logs are there!</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {teamMembers.map((member, idx) => {
              const avatarSrc = getAvatarUrl(member.avatar_url);

              return (
                <motion.div
                  key={`${member.id}-${member.role_name}`}
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1, duration: 0.5 }}
                >
                  <GlassCard className="text-center">
                    {avatarSrc ? (
                      <div className="relative w-32 h-32 mx-auto mb-6 rounded-2xl overflow-hidden border-4 border-background">
                        <img
                          src={avatarSrc}
                          alt={member.full_name || "Team member"}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => console.warn("Avatar failed to load:", avatarSrc)}
                        />
                      </div>
                    ) : (
                      <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-primary/30 to-accent/30 mx-auto mb-6 flex items-center justify-center">
                        <User className="w-16 h-16 text-primary/60" />
                      </div>
                    )}

                    <h3 className="text-2xl font-bold mb-1">{member.full_name || "Team Member"}</h3>

                    {member.job_title && member.job_title !== "Team Member" && (
                      <p className="text-lg text-foreground/80 font-medium mb-1">{member.job_title}</p>
                    )}

                    <p className="text-primary font-medium capitalize">
                      {member.role_name === "project_manager" ? "Project Manager" : member.role_name}
                    </p>
                  </GlassCard>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Mission Statement */}
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mt-32">
          <GlassCard className="max-w-4xl mx-auto text-center p-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Our Mission</h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              To Revolutionize the Construction Industry by Delivering Innovative, Futuristic and
              Sustainable Building Solutions that Exceed Client Expectations while Fostering a
              Culture of Safety, Integrity, and Continuous Improvement.
            </p>
          </GlassCard>
        </motion.div>
      </div>
    </div>
  );
};

export default Team;