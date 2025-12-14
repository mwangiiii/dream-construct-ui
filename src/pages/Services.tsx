// src/pages/Services.tsx or src/components/Services.tsx
// Complete Services component with custom phase filtering per sub-service

import { useState } from "react";
// Asset imports
import manufacturingPlants from "@/assets/1000049242.jpg";
import apartment from "@/assets/apartment.jpg";
import heroBuildingConstruction from "@/assets/hero-building-construction.jpg";
import heroCranesConstruction from "@/assets/hero-cranes-construction.jpg";
import hotels from "@/assets/hotels.jpg";
import officeBuildings from "@/assets/office_buildings.jpg";
import mixedUseOffice from "@/assets/mixed_use_office.jpg";
import hospitals from "@/assets/hospitals.jpg";
import heroRoadConstruction from "@/assets/hero-road-construction.jpg";
import educationalFacilities from "@/assets/educational_facilities.jpg";
import duplexes from "@/assets/duplexes.jpg";
import cooperHouse from "@/assets/cooper house.jpg";
import powerandEnergy from "@/assets/power_and_energy.jpg";
import waterAndDrainage from "@/assets/water_and_drainage.jpg";
import warehouse from "@/assets/warehouse.jpg";
import townHouses from "@/assets/town_houses.jpg";
import standAlone from "@/assets/stand_alone.mp4";
import shoppingMalls from "@/assets/shopping_malls.mp4";
import roadsAndHighways from "@/assets/roads_and_highways.mp4";
import restaurant from "@/assets/restaurant.jpg";
import qualityAssurance from "@/assets/quality_assurance.jpg";
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
  customPhases?: string; // Identifier for custom phase filtering
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
          mediaSrc: townHouses,
          mediaType: "image" as const,
          customPhases: "default", // Uses default phases
        },
        {
          name: "Duplexes",
          description: "Sophisticated duplex constructions offering privacy and space efficiency. Ideal for multi-generational living or investment properties with separate entrances and utilities.",
          mediaSrc: duplexes,
          mediaType: "image" as const,
          customPhases: "default",
        },
        {
          name: "Stand-Alone Houses",
          description: "Custom-built standalone homes tailored to your unique vision. Complete creative freedom with architectural design, landscaping, and interior customization.",
          mediaSrc: "https://res.cloudinary.com/dema3kxng/video/upload/v1765619795/stand_alone_kxn6r4.mp4",
          mediaType: "video" as const,
          customPhases: "default",
        },
        {
          name: "Cooperative Houses",
          description: "Affordable cooperative housing solutions designed for community living. Shared amenities, sustainable design, and collaborative ownership models.",
          mediaSrc: "https://res.cloudinary.com/dema3kxng/video/upload/v1765619992/corporate-building-video_ky6kqr.mp4",
          mediaType: "video" as const,
          customPhases: "default",
        },
        {
          name: "Luxury Villas",
          description: "Premium villa construction with high-end finishes, smart home integration, and bespoke architectural elements. Exclusive living spaces designed for sophistication.",
          mediaSrc: "https://res.cloudinary.com/dema3kxng/video/upload/v1765620117/Villa_K_by_gnk_architects_cpuvgx.mp4",
          mediaType: "video" as const,
          customPhases: "default",
        },
        {
          name: "Apartment Buildings",
          description: "Multi-unit residential complexes with modern amenities, energy-efficient systems, and optimized space utilization. From boutique buildings to large-scale developments.",
          mediaSrc: officeBuildings,
          mediaType: "image" as const,
          customPhases: "default",
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
          mediaSrc: apartment,
          mediaType: "image" as const,
          customPhases: "default",
        },
        {
          name: "Hotels",
          description: "Hospitality construction from boutique hotels to large resorts. Specialized in creating memorable guest experiences through thoughtful design and quality construction.",
          mediaSrc: restaurant,
          mediaType: "image" as const,
          customPhases: "default",
        },
        {
          name: "Restaurants",
          description: "Custom restaurant builds tailored to your culinary concept. From casual dining to fine establishments, we create spaces that enhance the dining experience.",
          mediaSrc: hotels,
          mediaType: "image" as const,
          customPhases: "default",
        },
        {
          name: "Schools / Universities",
          description: "Educational facility construction designed for learning excellence. Safe, accessible, and inspiring environments with modern classrooms, labs, and recreational spaces.",
          mediaSrc: educationalFacilities,
          mediaType: "image" as const,
          customPhases: "default",
        },
        {
          name: "Hospitals",
          description: "Healthcare facility construction meeting strict medical standards. Specialized in creating healing environments with advanced infrastructure and patient-centered design.",
          mediaSrc: hospitals,
          mediaType: "image" as const,
          customPhases: "default",
        },
        {
          name: "Shopping Malls / Centers",
          description: "Retail destination development with optimal traffic flow, diverse tenant spaces, and engaging customer experiences. Complete mall construction and renovation services.",
          mediaSrc: "https://res.cloudinary.com/dema3kxng/video/upload/v1765619794/shopping_malls_n4ffj0.mp4",
          mediaType: "video" as const,
          customPhases: "default",
        },
        {
          name: "Mixed-Use Office and Residential Centers",
          description: "Integrated mixed-use developments combining residential, commercial, and retail spaces. Creating vibrant urban communities with live-work-play convenience.",
          mediaSrc: mixedUseOffice,
          mediaType: "image" as const,
          customPhases: "default",
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
          mediaSrc: manufacturingPlants,
          mediaType: "image" as const,
          customPhases: "default",
        },
        {
          name: "Warehouses",
          description: "Modern warehouse construction with efficient storage systems, loading docks, and logistics infrastructure. Temperature-controlled and automated options available.",
          mediaSrc: warehouse,
          mediaType: "image" as const,
          customPhases: "default",
        },
        {
          name: "Distribution Centers",
          description: "Strategic distribution facility construction optimized for supply chain efficiency. Advanced material handling systems and scalable infrastructure.",
          mediaSrc: "https://res.cloudinary.com/dvjm4wcfr/image/upload/v1764790787/gym-95272_oqobjx.jpg",
          mediaType: "image" as const,
          customPhases: "default",
        },
        {
          name: "Industrial Parks",
          description: "Complete industrial park development with shared infrastructure, utilities, and amenities. Creating thriving industrial ecosystems for multiple businesses.",
          mediaSrc: "https://res.cloudinary.com/dema3kxng/video/upload/v1765619816/249564_medium_t0ziy7.mp4",
          mediaType: "video" as const,
          customPhases: "default",
        },
      ],
    },
    {
      icon: Factory,
      title: "Infrastructure",
      description: "Robust infrastructure solutions for public and private sectors, ensuring long-term reliability and efficiency.",
      features: [
        {
          name: "Roads & Highways",
          description: "Design and construction of durable roads, highways, and bridges with a focus on safety, sustainability, and traffic flow.",
          mediaSrc: "https://res.cloudinary.com/dema3kxng/video/upload/v1765620970/roads_and_highways_wamifd.mp4",
          mediaType: "video" as const,
          customPhases: "roads-highways",
        },
        {
          name: "Water Supply & Drainage",
          description: "Comprehensive water supply systems, drainage networks, and sewage treatment plants for urban and rural developments.",
          mediaSrc: waterAndDrainage,
          mediaType: "image" as const,
          customPhases: "water-drainage",
        },
        {
          name: "Power & Energy Infrastructure",
          description: "Construction of substations, power lines, and renewable energy facilities to support growing energy needs.",
          mediaSrc: powerandEnergy,
          mediaType: "image" as const,
          customPhases: "power-energy",
        },
        // {
        //   name: "Telecommunications",
        //   description: "Deployment of telecom towers, fiber optic networks, and digital infrastructure for enhanced connectivity.",
        //   mediaSrc: "https://res.cloudinary.com/dvjm4wcfr/image/upload/v1764792300/telecom-infrastructure-example.jpg",
        //   mediaType: "image" as const,
        //   customPhases: "telecommunications",
        // },
        {
          name: "Public Utilities",
          description: "Development of essential public utilities including gas pipelines, street lighting, and waste management systems.",
          mediaSrc: "https://res.cloudinary.com/dema3kxng/video/upload/v1765620154/138501-769724721_ocpzbr.mp4",
          mediaType: "video" as const,
          customPhases: "public-utilities",
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
          mediaSrc: "https://res.cloudinary.com/dema3kxng/image/upload/v1765621552/construction-site-682471_dpcruo.jpg",
          mediaType: "image" as const,
          customPhases: "interior-remodeling",
        },
        {
          name: "Exterior Upgrades",
          description: "Exterior renovation services including facade restoration, roofing, siding, and landscaping. Enhance curb appeal and structural integrity.",
          mediaSrc: "https://res.cloudinary.com/dema3kxng/image/upload/v1765621521/building-7053263_phv3ny.jpg",
          mediaType: "image" as const,
          customPhases: "exterior-upgrades",
        },
        {
          name: "Structural Renovations",
          description: "Major structural modifications including additions, extensions, and load-bearing changes. Expert engineering and construction for complex renovations.",
          mediaSrc: "https://res.cloudinary.com/dema3kxng/video/upload/v1765619794/31290-385265697_small_atg1aa.mp4",
          mediaType: "video" as const,
          customPhases: "structural-renovations",
        },
        {
          name: "Historic Restoration",
          description: "Specialized historic building restoration preserving architectural heritage while meeting modern codes. Careful craftsmanship honoring original design intent.",
          mediaSrc: "https://res.cloudinary.com/dema3kxng/image/upload/v1765625753/paint-2247394_iqrppx.jpg",
          mediaType: "image" as const,
          customPhases: "historic-restoration",
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
          mediaSrc: "https://res.cloudinary.com/dema3kxng/video/upload/v1765622123/architectural_design_nkevqh.mp4",
          mediaType: "video" as const,
          customPhases: "architectural-design",
        },
        {
          name: "Project Planning",
          description: "Strategic project planning including feasibility studies, budgeting, scheduling, and risk assessment. Setting your project up for success from day one.",
          mediaSrc: "https://res.cloudinary.com/dema3kxng/image/upload/v1765621649/engineer-4941174_1920_hpgzlx.jpg",
          mediaType: "image" as const,
          customPhases: "default",
        },
        {
          name: "Construction Management",
          description: "Professional construction management ensuring on-time, on-budget project delivery. Coordinating all trades, quality control, and client communication.",
          mediaSrc: "https://res.cloudinary.com/dema3kxng/image/upload/v1765621665/construction-site-4020496_gxdvqp.jpg",
          mediaType: "image" as const,
          customPhases: "default",
        },
        {
          name: "Quality Assurance",
          description: "Rigorous quality assurance programs including inspections, testing, and compliance verification. Ensuring the highest standards throughout construction.",
          mediaSrc: "https://res.cloudinary.com/dema3kxng/image/upload/v1765622322/quality_assurance_upzbmx.jpg",
          mediaType: "image" as const,
          customPhases: "quality-assurance",
        },
      ],
    },
  ];

  // Default phases (for Residential, Commercial, Industrial, Project Planning, Construction Management)
  const defaultPhases = [
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

  // Custom phase configurations
  const customPhaseConfigs = {
    // Roads & Highways - remove 3.2, 3.3, 3.4, keep only 3.1, 3.5 (electrical and plumbing only), 3.7, 3.8
    "roads-highways": [
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
        ],
      },
      {
        number: "03",
        title: "Construction",
        stages: [
          { step: "3.1", title: "Mobilization and Site Preparation" },
          { step: "3.5", title: "Electrical and Plumbing" },
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
    ],

    // Water Supply & Drainage - remove 3.4, 3.5, 3.6, 3.7, 3.8
    "water-drainage": [
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
        ],
      },
      {
        number: "03",
        title: "Construction",
        stages: [
          { step: "3.1", title: "Mobilization and Site Preparation" },
          { step: "3.2", title: "Foundation" },
          { step: "3.3", title: "Structural Frames" },
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
    ],

    // Power & Energy Infrastructure - retain 3.1-3.3, remove 3.4, keep electrical only in 3.5, modify 3.6 to cladding only, retain 3.7, 3.8
    "power-energy": [
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
        ],
      },
      {
        number: "03",
        title: "Construction",
        stages: [
          { step: "3.1", title: "Mobilization and Site Preparation" },
          { step: "3.2", title: "Foundation" },
          { step: "3.3", title: "Structural Frames" },
          { step: "3.5", title: "Mechanical and Electrical" },
          { step: "3.6", title: "Cladding" },
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
    ],

    // Telecommunications - remove 3.4, 3.6, 3.8, retain 3.7
    "telecommunications": [
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
        ],
      },
      {
        number: "03",
        title: "Construction",
        stages: [
          { step: "3.1", title: "Mobilization and Site Preparation" },
          { step: "3.2", title: "Foundation" },
          { step: "3.3", title: "Structural Frames" },
          { step: "3.5", title: "Mechanical, Electrical and Plumbing (MEP) Roughing" },
          { step: "3.7", title: "MEP Fitout and Final Connections" },
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
    ],

    // Public Utilities - retain everything (use default)
    "public-utilities": defaultPhases,

    // Interior Remodeling - remove entire construction phase
    "interior-remodeling": [
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
    ],

    // Exterior Upgrades - retain phase 1, 2, 4; under construction remove 3.2, 3.3, 3.6
    "exterior-upgrades": [
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
        ],
      },
      {
        number: "03",
        title: "Construction",
        stages: [
          { step: "3.1", title: "Mobilization and Site Preparation" },
          { step: "3.4", title: "Envelope and Roofing" },
          { step: "3.5", title: "Mechanical, Electrical and Plumbing (MEP) Roughing" },
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
    ],

    // Structural Renovations - remove 3.2
    "structural-renovations": [
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
        ],
      },
      {
        number: "03",
        title: "Construction",
        stages: [
          { step: "3.1", title: "Mobilization and Site Preparation" },
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
    ],

    // Historic Restoration - retain 3.4, 3.6, 3.8 only under phase 3
    "historic-restoration": [
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
        ],
      },
      {
        number: "03",
        title: "Construction",
        stages: [
          { step: "3.4", title: "Envelope and Roofing" },
          { step: "3.6", title: "Interior Finishes and Cladding" },
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
    ],

    // Architectural Design - retain phase 1, 2 only
    "architectural-design": [
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
        ],
      },
    ],

    // Quality Assurance - retain phase 3 and 4 only
    "quality-assurance": [
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
    ],
  };

  // Function to get phases based on customPhases identifier
  const getPhasesForSubService = (customPhasesId: string | undefined) => {
    if (!customPhasesId || customPhasesId === "default") {
      return defaultPhases;
    }
    return customPhaseConfigs[customPhasesId as keyof typeof customPhaseConfigs] || defaultPhases;
  };

  const openPopup = (feature: any, category: string) => {
    setSelectedSubService({
      title: feature.name,
      serviceCategory: category,
      description: feature.description,
      mediaSrc: feature.mediaSrc,
      mediaType: feature.mediaType,
      customPhases: feature.customPhases,
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
              {defaultPhases.map((phase, phaseIdx) => (
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
        phases={getPhasesForSubService(selectedSubService.customPhases)}
      />
    </>
  );
};

export default Services;