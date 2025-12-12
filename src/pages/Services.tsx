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
          icon: Factory, // Reuse Factory icon for infrastructure, or replace with a more suitable icon if available
          title: "Infrastructure",
          description: "Robust infrastructure solutions for public and private sectors, ensuring long-term reliability and efficiency.",
          features: [
            {
              name: "Roads & Highways",
              description: "Design and construction of durable roads, highways, and bridges with a focus on safety, sustainability, and traffic flow.",
              mediaSrc: "https://res.cloudinary.com/dvjm4wcfr/image/upload/v1764792000/road-highway-example.jpg",
              mediaType: "image" as const,
            },
            {
              name: "Water Supply & Drainage",
              description: "Comprehensive water supply systems, drainage networks, and sewage treatment plants for urban and rural developments.",
              mediaSrc: "https://res.cloudinary.com/dvjm4wcfr/image/upload/v1764792100/water-infrastructure-example.jpg",
              mediaType: "image" as const,
            },
            {
              name: "Power & Energy Infrastructure",
              description: "Construction of substations, power lines, and renewable energy facilities to support growing energy needs.",
              mediaSrc: "https://res.cloudinary.com/dvjm4wcfr/image/upload/v1764792200/power-infrastructure-example.jpg",
              mediaType: "image" as const,
            },
            {
              name: "Telecommunications",
              description: "Deployment of telecom towers, fiber optic networks, and digital infrastructure for enhanced connectivity.",
              mediaSrc: "https://res.cloudinary.com/dvjm4wcfr/image/upload/v1764792300/telecom-infrastructure-example.jpg",
              mediaType: "image" as const,
            },
            {
              name: "Public Utilities",
              description: "Development of essential public utilities including gas pipelines, street lighting, and waste management systems.",
              mediaSrc: "https://res.cloudinary.com/dvjm4wcfr/image/upload/v1764792400/public-utilities-example.jpg",
              mediaType: "image" as const,
            },
          ],
        },
    {
      icon: Home,
      title: "Residential Construction",
      description: "From concept to completion, we create living spaces that are Family-Friendly and Reflect your Lifestyle.",
      features: [
        {
          name: "Town Houses",
          description: "Modern townhouse developments featuring contemporary design, efficient layouts, and community-focused amenities. Perfect for families seeking urban convenience with suburban comfort.",
          mediaSrc: "https://res.cloudinary.com/dvjm4wcfr/image/upload/v1764703565/Town_house_iykd1h.jpg", // Add your CDN URL here
          mediaType: "image" as const,
        },
        {
          name: "Duplexes",
          description: "Sophisticated duplex constructions offering privacy and space efficiency. Ideal for multi-generational living or investment properties with separate entrances and utilities.",
          mediaSrc: "https://res.cloudinary.com/dvjm4wcfr/image/upload/v1764703563/Duplex_nx1iyn.jpg",
          mediaType: "image" as const,
        },
        {
          name: "Stand-Alone Houses",
          description: "Custom-built standalone homes tailored to your unique vision. Complete creative freedom with architectural design, landscaping, and interior customization.",
          mediaSrc: "https://res.cloudinary.com/dvjm4wcfr/image/upload/v1764703561/Stand_Alone_Villa_Design_Proposal_-_Hazem_Gabr_c0fdrf.jpg",
          mediaType: "image" as const,
        },
        {
          name: "Cooperative Houses",
          description: "Affordable cooperative housing solutions designed for community living. Shared amenities, sustainable design, and collaborative ownership models.",
          mediaSrc: "https://res.cloudinary.com/dvjm4wcfr/video/upload/v1764703565/corporate-building-video_gtyqje.mp4",
          mediaType: "video" as const,
        },
        {
          name: "Luxury Villas",
          description: "Premium villa construction with high-end finishes, smart home integration, and bespoke architectural elements. Exclusive living spaces designed for sophistication.",
          mediaSrc: "https://res.cloudinary.com/dvjm4wcfr/video/upload/v1764703590/Villa_K_by_gnk_architects_c0blia.mp4",
          mediaType: "video" as const,
        },
        {
          name: "Apartment Buildings",
          description: "Multi-unit residential complexes with modern amenities, energy-efficient systems, and optimized space utilization. From boutique buildings to large-scale developments.",
          mediaSrc: "https://res.cloudinary.com/dvjm4wcfr/image/upload/v1764790810/apartment-building-888681_cpd1z1.jpg",
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
          mediaSrc: "https://res.cloudinary.com/dvjm4wcfr/image/upload/v1764790800/restaurant-5521372_f8cvcy.jpg",
          mediaType: "image" as const,
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
          mediaSrc: "https://res.cloudinary.com/dvjm4wcfr/video/upload/v1764790843/a9015597-e852-4cfb-ae6b-9a1ca39768ec_7361308_zvvexj.mp4",
          mediaType: "video" as const,
        },
        {
          name: "Hospitals",
          description: "Healthcare facility construction meeting strict medical standards. Specialized in creating healing environments with advanced infrastructure and patient-centered design.",
          mediaSrc: "https://res.cloudinary.com/dvjm4wcfr/video/upload/v1764790877/215239_w9axxj.mp4",
          mediaType: "video" as const,
        },
        {
          name: "Shopping Malls / Centers",
          description: "Retail destination development with optimal traffic flow, diverse tenant spaces, and engaging customer experiences. Complete mall construction and renovation services.",
          mediaSrc: "https://res.cloudinary.com/dvjm4wcfr/video/upload/v1764791021/138501-769724721_a5fh7f.mp4",
          mediaType: "video" as const,
        },
        {
          name: "Mixed-Use Office and Residential Centers",
          description: "Integrated mixed-use developments combining residential, commercial, and retail spaces. Creating vibrant urban communities with live-work-play convenience.",
          mediaSrc: "https://res.cloudinary.com/dvjm4wcfr/video/upload/v1764790791/1057-142621433_medium_lkqohi.mp4",
          mediaType: "video" as const,
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
          mediaSrc: "https://res.cloudinary.com/dvjm4wcfr/video/upload/v1764790808/43658-436719135_omuakt.mp4",
          mediaType: "video" as const,
        },
        {
          name: "Distribution Centers",
          description: "Strategic distribution facility construction optimized for supply chain efficiency. Advanced material handling systems and scalable infrastructure.",
          mediaSrc: "https://res.cloudinary.com/dvjm4wcfr/image/upload/v1764790787/gym-95272_oqobjx.jpg",
          mediaType: "image" as const,
        },
        {
          name: "Industrial Parks",
          description: "Complete industrial park development with shared infrastructure, utilities, and amenities. Creating thriving industrial ecosystems for multiple businesses.",
          mediaSrc: "https://res.cloudinary.com/dvjm4wcfr/video/upload/v1764790776/249564_medium_u4dhr8.mp4",
          mediaType: "video" as const,
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
          mediaSrc: "https://res.cloudinary.com/dvjm4wcfr/image/upload/v1764790782/construction-site-682471_ucvrvf.jpg",
          mediaType: "image" as const,
        },
        {
          name: "Exterior Upgrades",
          description: "Exterior renovation services including facade restoration, roofing, siding, and landscaping. Enhance curb appeal and structural integrity.",
          mediaSrc: "https://res.cloudinary.com/dvjm4wcfr/image/upload/v1764791639/building-7053263_uok2rl.jpg",
          mediaType: "image" as const,
        },
        {
          name: "Structural Renovations",
          description: "Major structural modifications including additions, extensions, and load-bearing changes. Expert engineering and construction for complex renovations.",
          mediaSrc: "https://res.cloudinary.com/dvjm4wcfr/video/upload/v1764790762/31290-385265697_small_aywngv.mp4",
          mediaType: "video" as const,
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
          mediaSrc: "https://res.cloudinary.com/dvjm4wcfr/image/upload/v1764790759/engineer-4941174_1920_dhwyql.jpg",
          mediaType: "image" as const,
        },
        {
          name: "Construction Management",
          description: "Professional construction management ensuring on-time, on-budget project delivery. Coordinating all trades, quality control, and client communication.",
          mediaSrc: "https://res.cloudinary.com/dvjm4wcfr/image/upload/v1764790761/construction-site-4020496_kxmzbq.jpg",
          mediaType: "image" as const,
        },
        {
          name: "Quality Assurance",
          description: "Rigorous quality assurance programs including inspections, testing, and compliance verification. Ensuring the highest standards throughout construction.",
          mediaSrc: "https://res.cloudinary.com/dvjm4wcfr/image/upload/v1764790761/woman-2759503_rqmust.jpg",
          mediaType: "image" as const,
        },
      ],
    },
  ];

  const oldStages = ["Consultation", "Planning", "Execution", "Delivery"]; // Kept for reference if needed

  const phases = [
    {
      number: "01",
      title: "Conception and Feasibility",
      stages: [
        { step: "1.1", title: "Decision and Land Purchase" },
        { step: "1.2", title: "Feasibility Study and Business Case" },
      ],
    },
    {
      number: "02",
      title: "Pre-Construction",
      stages: [
        { step: "2.1", title: "Design Planning" },
        { step: "2.2", title: "Schematic Designing" },
        { step: "2.3", title: "Construction Documents and Approvals" },
        // { step: "2.4", title: "Contractor Selection" },
      ],
    },
    {
      number: "03",
      title: "Construction",
      stages: [
        { step: "3.1", title: "Mobilization and Site Preparation" },
        { step: "3.2", title: "Foundation" },
        { step: "3.3", title: "Structural Frames" },
        { step: "3.4", title: "Envelope and Roofing" },
        { step: "3.5", title: "Mechanical, Electrical and Plumbing (MEP) Roughing" },
        { step: "3.6", title: "Interior Finishes and Cladding" },
        { step: "3.7", title: "MEP Fitout and Final Connections" },
        { step: "3.8", title: "External Works" },
      ],
    },
    {
      number: "04",
      title: "Inspections and Snagging",
      stages: [
        { step: "4.1", title: "Final Inspections and Snagging" },
        { step: "4.2", title: "Handover and Commissioning" },
        { step: "4.3", title: "Project Closeout" },
        { step: "4.4", title: "Aftercare and Warranty" },
      ],
    },
  ];

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

            <div className="space-y-12">
              {phases.map((phase, phaseIdx) => (
                <motion.div
                  key={phase.number}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: phaseIdx * 0.2 }}
                  className="group"
                >
                  <GlassCard className="relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="relative z-10">
                      <div className="flex items-center mb-6 pt-4">
                        <div className="text-4xl font-bold text-primary/20 mr-4">{phase.number}</div>
                        <h3 className="text-2xl font-bold text-foreground">{phase.title}</h3>
                      </div>
                      <div className="grid gap-4">
                        {phase.stages.map((stage, stageIdx) => (
                          <motion.div
                            key={stage.step}
                            initial={{ opacity: 0, x: -10 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: phaseIdx * 0.1 + stageIdx * 0.05 }}
                            className="flex items-start space-x-4 p-3 rounded-lg hover:bg-primary/5 transition-colors duration-200"
                          >
                            <div className="w-6 h-6 flex-shrink-0 mt-1 flex items-center justify-center">
                              <span className="text-sm font-mono text-primary/60">{stage.step}</span>
                            </div>
                            <div>
                              <h4 className="font-semibold text-foreground">{stage.title}</h4>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
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
        phases={phases}
      />
    </>
  );
};

export default Services;