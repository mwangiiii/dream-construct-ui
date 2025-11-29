// src/pages/Services.tsx or src/components/Services.tsx
// Complete Services component with sub-service popup integration

import { useState } from "react";
import { motion } from "framer-motion";
import { Building2, Home, Factory, Wrench, Paintbrush } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GlassCard } from "@/components/ui/GlassCard";
import SubServicePopup from "@/components/SubServicePopup";

interface SubServiceData {
  title: string;
  serviceCategory: string;
  description: string;
  mediaSrc?: string;
  mediaType?: "image" | "video";
}

const Services = () => {
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [selectedSubService, setSelectedSubService] = useState<SubServiceData>({
    title: "",
    serviceCategory: "",
    description: "",
  });

  const services = [
    {
      icon: Home,
      title: "Residential Construction",
      description: "From concept to completion, we create living spaces that are Family-Friendly and Reflect your Lifestyle.",
      features: [
        {
          name: "Town Houses",
          description: "Modern townhouse developments featuring contemporary design, efficient layouts, and community-focused amenities. Perfect for families seeking urban convenience with suburban comfort.",
          mediaSrc: "", // Add your CDN URL here
          mediaType: "image" as const,
        },
        {
          name: "Duplexes",
          description: "Sophisticated duplex constructions offering privacy and space efficiency. Ideal for multi-generational living or investment properties with separate entrances and utilities.",
          mediaSrc: "",
          mediaType: "image" as const,
        },
        {
          name: "Stand-Alone Houses",
          description: "Custom-built standalone homes tailored to your unique vision. Complete creative freedom with architectural design, landscaping, and interior customization.",
          mediaSrc: "",
          mediaType: "image" as const,
        },
        {
          name: "Cooperative Houses",
          description: "Affordable cooperative housing solutions designed for community living. Shared amenities, sustainable design, and collaborative ownership models.",
          mediaSrc: "",
          mediaType: "image" as const,
        },
        {
          name: "Luxury Villas",
          description: "Premium villa construction with high-end finishes, smart home integration, and bespoke architectural elements. Exclusive living spaces designed for sophistication.",
          mediaSrc: "",
          mediaType: "image" as const,
        },
        {
          name: "Apartment Buildings",
          description: "Multi-unit residential complexes with modern amenities, energy-efficient systems, and optimized space utilization. From boutique buildings to large-scale developments.",
          mediaSrc: "",
          mediaType: "image" as const,
        },
      ],
    },
    {
      icon: Building2,
      title: "Commercial Projects",
      description: "Commercial complexes, designed for functionality that help thrive to success.",
      features: [
        {
          name: "Office Buildings",
          description: "State-of-the-art office spaces designed for productivity and collaboration. Features include flexible floor plans, modern infrastructure, and sustainable building practices.",
          mediaSrc: "",
          mediaType: "image" as const,
        },
        {
          name: "Hotels",
          description: "Hospitality construction from boutique hotels to large resorts. Specialized in creating memorable guest experiences through thoughtful design and quality construction.",
          mediaSrc: "",
          mediaType: "video" as const,
        },
        {
          name: "Restaurants",
          description: "Custom restaurant builds tailored to your culinary concept. From casual dining to fine establishments, we create spaces that enhance the dining experience.",
          mediaSrc: "",
          mediaType: "image" as const,
        },
        {
          name: "Schools / Universities",
          description: "Educational facility construction designed for learning excellence. Safe, accessible, and inspiring environments with modern classrooms, labs, and recreational spaces.",
          mediaSrc: "",
          mediaType: "image" as const,
        },
        {
          name: "Hospitals",
          description: "Healthcare facility construction meeting strict medical standards. Specialized in creating healing environments with advanced infrastructure and patient-centered design.",
          mediaSrc: "",
          mediaType: "image" as const,
        },
        {
          name: "Shopping Malls / Centers",
          description: "Retail destination development with optimal traffic flow, diverse tenant spaces, and engaging customer experiences. Complete mall construction and renovation services.",
          mediaSrc: "",
          mediaType: "image" as const,
        },
        {
          name: "Mixed-Use Office and Residential Centers",
          description: "Integrated mixed-use developments combining residential, commercial, and retail spaces. Creating vibrant urban communities with live-work-play convenience.",
          mediaSrc: "",
          mediaType: "image" as const,
        },
      ],
    },
    {
      icon: Factory,
      title: "Industrial Construction",
      description: "Large-scale industrial facilities, warehouses, and manufacturing plants engineered for efficiency and built to industry standards.",
      features: [
        {
          name: "Manufacturing Plants",
          description: "Heavy-duty manufacturing facilities designed for operational efficiency. Specialized in heavy equipment installation, workflow optimization, and safety compliance.",
          mediaSrc: "",
          mediaType: "image" as const,
        },
        {
          name: "Warehouses",
          description: "Modern warehouse construction with efficient storage systems, loading docks, and logistics infrastructure. Temperature-controlled and automated options available.",
          mediaSrc: "",
          mediaType: "image" as const,
        },
        {
          name: "Distribution Centers",
          description: "Strategic distribution facility construction optimized for supply chain efficiency. Advanced material handling systems and scalable infrastructure.",
          mediaSrc: "",
          mediaType: "image" as const,
        },
        {
          name: "Industrial Parks",
          description: "Complete industrial park development with shared infrastructure, utilities, and amenities. Creating thriving industrial ecosystems for multiple businesses.",
          mediaSrc: "",
          mediaType: "image" as const,
        },
      ],
    },
    {
      icon: Wrench,
      title: "Renovations & Remodeling",
      description: "Transform existing spaces with our expert renovation services. We breathe new life into buildings while preserving their character.",
      features: [
        {
          name: "Interior Remodeling",
          description: "Complete interior transformations including layout redesign, finishes upgrade, and modernization. From kitchens and bathrooms to entire floor renovations.",
          mediaSrc: "",
          mediaType: "image" as const,
        },
        {
          name: "Exterior Upgrades",
          description: "Exterior renovation services including facade restoration, roofing, siding, and landscaping. Enhance curb appeal and structural integrity.",
          mediaSrc: "",
          mediaType: "image" as const,
        },
        {
          name: "Structural Renovations",
          description: "Major structural modifications including additions, extensions, and load-bearing changes. Expert engineering and construction for complex renovations.",
          mediaSrc: "",
          mediaType: "image" as const,
        },
        {
          name: "Historic Restoration",
          description: "Specialized historic building restoration preserving architectural heritage while meeting modern codes. Careful craftsmanship honoring original design intent.",
          mediaSrc: "",
          mediaType: "image" as const,
        },
      ],
    },
    {
      icon: Paintbrush,
      title: "Design & Consulting",
      description: "Expert architectural design and construction consulting services to guide your project from vision to reality with professional expertise.",
      features: [
        {
          name: "Architectural Design",
          description: "Comprehensive architectural design services from concept sketches to detailed construction documents. Creative solutions balancing aesthetics, function, and budget.",
          mediaSrc: "",
          mediaType: "image" as const,
        },
        {
          name: "Project Planning",
          description: "Strategic project planning including feasibility studies, budgeting, scheduling, and risk assessment. Setting your project up for success from day one.",
          mediaSrc: "",
          mediaType: "image" as const,
        },
        {
          name: "Construction Management",
          description: "Professional construction management ensuring on-time, on-budget project delivery. Coordinating all trades, quality control, and client communication.",
          mediaSrc: "",
          mediaType: "image" as const,
        },
        {
          name: "Quality Assurance",
          description: "Rigorous quality assurance programs including inspections, testing, and compliance verification. Ensuring the highest standards throughout construction.",
          mediaSrc: "",
          mediaType: "image" as const,
        },
      ],
    },
  ];

  const stages = ["Consultation", "Planning", "Execution", "Delivery"];

  const openPopup = (feature: any, category: string) => {
    setSelectedSubService({
      title: feature.name,
      serviceCategory: category,
      description: feature.description,
      mediaSrc: feature.mediaSrc,
      mediaType: feature.mediaType,
    });
    setIsPopupOpen(true);
  };

  const closePopup = () => {
    setIsPopupOpen(false);
  };

  return (
    <>
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
                      <button
                        key={feature.name}
                        onClick={() => openPopup(feature, service.title)}
                        className="w-full flex items-center text-sm text-muted-foreground hover:text-primary transition-all duration-300 p-2 rounded-md hover:bg-primary/5 group"
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-primary mr-3 flex-shrink-0 group-hover:scale-150 transition-transform" />
                        <span className="group-hover:translate-x-1 transition-transform">{feature.name}</span>
                      </button>
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

      {/* Popup */}
      <SubServicePopup
        isOpen={isPopupOpen}
        onClose={closePopup}
        subService={selectedSubService}
        stages={stages}
      />
    </>
  );
};

export default Services;