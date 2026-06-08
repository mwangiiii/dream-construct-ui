import { motion } from "framer-motion";
import { Target, Heart, Award, Users, Clock, User, AlertCircle } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GlassCard } from "@/components/ui/GlassCard";
import { supabase } from "@/lib/supabaseClient";
import { useEffect, useState } from "react";

interface TeamMember {
  id: string;
  full_name: string;
  avatar_url: string | null;
  job_title: string | null;
  role_name: string;
}

// Role display priority — highest wins when a user holds multiple roles
const ROLE_PRIORITY: Record<string, number> = {
  admin:           1,
  manager:         2,
  project_manager: 3,
  finance:         4,
  surveyor:        5,
};

const ROLE_LABELS: Record<string, string> = {
  admin:           "Admin",
  manager:         "Manager",
  project_manager: "Project Manager",
  finance:         "Finance",
  surveyor:        "Surveyor",
};

const TEAM_ROLES = Object.keys(ROLE_PRIORITY);

const Team = () => {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);

  useEffect(() => {
    const fetchTeam = async () => {
      try {
        // Step 1: Get all role rows for internal staff roles
        const { data: rolesData, error: rolesError } = await supabase
          .from("user_roles")
          .select("user_id, role_name")
          .in("role_name", TEAM_ROLES);

        if (rolesError) throw rolesError;
        if (!rolesData || rolesData.length === 0) { setTeamMembers([]); return; }

        // Build a map: userId → primary role (highest priority wins)
        const primaryRole = new Map<string, string>();
        for (const row of rolesData) {
          const existing = primaryRole.get(row.user_id);
          const newPriority = ROLE_PRIORITY[row.role_name] ?? 99;
          const existingPriority = existing ? (ROLE_PRIORITY[existing] ?? 99) : 99;
          if (!existing || newPriority < existingPriority) {
            primaryRole.set(row.user_id, row.role_name);
          }
        }

        const userIds = [...primaryRole.keys()];

        // Step 2: Fetch profiles — only those with show_on_team_page = true
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url, job_title")
          .in("id", userIds)
          .eq("show_on_team_page", true);

        if (profilesError) throw profilesError;
        if (!profilesData || profilesData.length === 0) { setTeamMembers([]); return; }

        // Step 3: Build deduplicated member list, one entry per person
        const members: TeamMember[] = profilesData.map(profile => ({
          id:         profile.id,
          full_name:  profile.full_name || "Team Member",
          avatar_url: profile.avatar_url,
          job_title:  profile.job_title || null,
          role_name:  primaryRole.get(profile.id) || "surveyor",
        }));

        // Sort: top-level leadership titles first, then role priority, then alphabetically
        const LEADER_KEYWORDS = ["ceo", "chief executive", "founder", "co-founder", "managing director", "president", "owner"];
        const isLeader = (m: TeamMember) => {
          const title = m.job_title?.toLowerCase().trim() ?? "";
          return LEADER_KEYWORDS.some(kw => title.includes(kw));
        };

        members.sort((a, b) => {
          if (isLeader(a) !== isLeader(b)) return isLeader(a) ? -1 : 1;
          const pd = (ROLE_PRIORITY[a.role_name] ?? 99) - (ROLE_PRIORITY[b.role_name] ?? 99);
          if (pd !== 0) return pd;
          return a.full_name.localeCompare(b.full_name);
        });

        setTeamMembers(members);
      } catch (err: any) {
        setError(err.message || "Failed to load team members");
      } finally {
        setLoading(false);
      }
    };

    fetchTeam();
  }, []);

  const getAvatarUrl = (path: string | null): string | null => {
    if (!path) return null;
    if (path.startsWith("http")) return path;
    const { data } = supabase.storage.from("profile-pictures").getPublicUrl(path);
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
            About <span className="text-primary"> Reve Construct Limited</span>
          </h1>
          <p className="text-xl text-muted-foreground leading-relaxed mb-8">
            Reve Construct Limited is at the Forefront of Creative, Eco-friendly and Human-friendly Construction
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
        ) : error ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <p className="text-xl font-semibold mb-2">Could not load team</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        ) : teamMembers.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-2xl text-muted-foreground mb-4">No team members to display.</p>
            <p className="text-sm text-muted-foreground">
              Team members are shown here once an admin enables their visibility.
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {teamMembers.map((member, idx) => {
              const avatarSrc = getAvatarUrl(member.avatar_url);

              return (
                <motion.div
                  key={member.id}
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
                          alt={member.full_name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    ) : (
                      <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-primary/30 to-accent/30 mx-auto mb-6 flex items-center justify-center">
                        <User className="w-16 h-16 text-primary/60" />
                      </div>
                    )}

                    <h3 className="text-2xl font-bold mb-1">{member.full_name}</h3>

                    <p className="text-primary font-medium">
                      {member.job_title || (ROLE_LABELS[member.role_name] ?? member.role_name)}
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