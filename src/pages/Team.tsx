import { motion } from "framer-motion";
import { Target, Heart, Award, Users, Clock } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GlassCard } from "@/components/ui/GlassCard";

const Team = () => {
  const teamMembers = [
    {
      name: "Michael Chen",
      role: "CEO & Founder",
      image: "executive",
      bio: "25+ years of construction excellence",
    },
    {
      name: "Sarah Johnson",
      role: "Chief Architect",
      image: "architect",
      bio: "Award-winning design specialist",
    },
    {
      name: "David Rodriguez",
      role: "Project Manager",
      image: "manager",
      bio: "Expert in large-scale projects",
    },
    {
      name: "Emily Zhang",
      role: "Engineering Lead",
      image: "engineer",
      bio: "Structural engineering expert",
    },
    {
      name: "James Wilson",
      role: "Construction Manager",
      image: "construction",
      bio: "Field operations specialist",
    },
    {
      name: "Lisa Park",
      role: "Quality Assurance",
      image: "quality",
      bio: "Excellence in every detail",
    },
  ];

  const values = [
    {
      icon: Target,
      title: "Quality",
      description: "We Pledge to deliver quality work from our qualified team.",
    },
    {
      icon: Heart,
      title: "Integrity",
      description: "Honest communication and ethical practices form the foundation of all our relationships and work.",
    },
    {
      icon: Clock,
      title: "Time",
      description: "Where We Deliver Our Work On Time, Every Time.",
    },
    {
      icon: Award,
      title: "Innovation",
      description: "We Deliver Creative and Sustainable Solutions that Push the Boundaries of Traditional Construction for You.",
    },
    {
      icon: Users,
      title: "Collaboration",
      description: "Working together with clients, partners, and teams to achieve extraordinary results.",
    },
  ];

  return (
    <div className="min-h-screen pt-32 pb-20">
      <div className="container mx-auto px-6">
        {/* Company Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto text-center mb-32"
        >
          <h1 className="text-5xl md:text-7xl font-bold mb-6">
            About <span className="text-primary">Dream Construct</span>
          </h1>
          <p className="text-xl text-muted-foreground leading-relaxed mb-8">
            Dream Construct Limited is at the Forefront of Creative, Eco-friendly and Human-friendly Construction
            Excellence, Transforming Visions into Reality Through Innovation, expertise, and
            Unwavering Commitment to Quality and Time.
          </p>
          {/* <p className="text-lg text-muted-foreground leading-relaxed">
            From residential masterpieces to commercial landmarks and industrial facilities, our
            diverse portfolio showcases our ability to deliver exceptional results across all
            construction sectors.
          </p> */}
        </motion.div>

        {/* Values Section */}
        <SectionHeading
          title="Our Values"
          subtitle="The principles that guide everything we do"
          className="mb-16"
        />

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-32">
          {values.map((value, idx) => (
            <motion.div
              key={value.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
            >
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
        <SectionHeading
          title="Meet Our Team"
          subtitle="Expert professionals dedicated to bringing your vision to life"
          className="mb-16"
        />

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {teamMembers.map((member, idx) => (
            <motion.div
              key={member.name}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1, duration: 0.5 }}
            >
              <GlassCard className="text-center">
                <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-primary/30 to-accent/30 mx-auto mb-6" />
                <h3 className="text-2xl font-bold mb-1">{member.name}</h3>
                <p className="text-primary font-medium mb-3">{member.role}</p>
                <p className="text-sm text-muted-foreground">{member.bio}</p>
              </GlassCard>
            </motion.div>
          ))}
        </div>

        {/* Mission Statement */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-32"
        >
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
