import { motion } from "framer-motion";
import { Building2, Home, Factory, Wrench, Hammer, Paintbrush } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GlassCard } from "@/components/ui/GlassCard";

const Services = () => {
  const services = [
    {
      icon: Home,
      title: "Residential Construction",
      description: "Custom homes, luxury villas, and residential complexes built with precision and care. From concept to completion, we create living spaces that reflect your lifestyle.",
      features: ["Custom Home Design", "Luxury Villas", "Apartment Buildings", "Home Renovations"],
    },
    {
      icon: Building2,
      title: "Commercial Projects",
      description: "Modern office buildings, retail spaces, and commercial complexes designed for functionality and aesthetic appeal that drives business success.",
      features: ["Office Buildings", "Retail Spaces", "Shopping Centers", "Mixed-Use Developments"],
    },
    {
      icon: Factory,
      title: "Industrial Construction",
      description: "Large-scale industrial facilities, warehouses, and manufacturing plants engineered for efficiency and built to industry standards.",
      features: ["Manufacturing Plants", "Warehouses", "Distribution Centers", "Industrial Parks"],
    },
    {
      icon: Hammer,
      title: "Infrastructure & Roads",
      description: "Quality road construction, bridges, and infrastructure projects that connect communities and support economic growth.",
      features: ["Highway Construction", "Bridge Building", "Urban Infrastructure", "Road Maintenance"],
    },
    {
      icon: Wrench,
      title: "Renovations & Remodeling",
      description: "Transform existing spaces with our expert renovation services. We breathe new life into buildings while preserving their character.",
      features: ["Interior Remodeling", "Exterior Upgrades", "Structural Renovations", "Historic Restoration"],
    },
    {
      icon: Paintbrush,
      title: "Design & Consulting",
      description: "Expert architectural design and construction consulting services to guide your project from vision to reality with professional expertise.",
      features: ["Architectural Design", "Project Planning", "Construction Management", "Quality Assurance"],
    },
  ];

  return (
    <div className="min-h-screen pt-32 pb-20">
      <div className="container mx-auto px-6">
        <SectionHeading
          title="Our Services"
          subtitle="Comprehensive construction solutions tailored to your needs with unmatched quality and innovation"
          className="mb-20"
        />

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {services.map((service, idx) => (
            <motion.div
              key={service.title}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1, duration: 0.6 }}
            >
              <GlassCard className="h-full flex flex-col">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-6">
                  <service.icon className="w-7 h-7 text-primary" />
                </div>
                
                <h3 className="text-2xl font-bold mb-3">{service.title}</h3>
                <p className="text-muted-foreground mb-6 flex-grow">{service.description}</p>
                
                <div className="space-y-2">
                  {service.features.map((feature) => (
                    <div key={feature} className="flex items-center text-sm text-muted-foreground">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary mr-3" />
                      {feature}
                    </div>
                  ))}
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>

        {/* Process Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-32"
        >
          <SectionHeading
            title="Our Process"
            subtitle="A proven methodology that ensures excellence at every stage"
            className="mb-16"
          />

          <div className="grid md:grid-cols-4 gap-6">
            {[
              { step: "01", title: "Consultation", desc: "Understanding your vision and requirements" },
              { step: "02", title: "Planning", desc: "Detailed design and project roadmap" },
              { step: "03", title: "Execution", desc: "Expert construction with quality control" },
              { step: "04", title: "Delivery", desc: "Final inspection and handover" },
            ].map((phase, idx) => (
              <motion.div
                key={phase.step}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.15 }}
              >
                <GlassCard>
                  <div className="text-5xl font-bold text-primary/20 mb-4">{phase.step}</div>
                  <h4 className="text-xl font-bold mb-2">{phase.title}</h4>
                  <p className="text-sm text-muted-foreground">{phase.desc}</p>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Services;
