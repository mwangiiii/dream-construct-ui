import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, ArrowRight, Star, Users, Award, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/GlassCard";

const Index = () => {
  const [currentSlide, setCurrentSlide] = useState(0);

  const heroSlides = [
    {
      title: "Building Tomorrow's",
      highlight: "Landmarks",
      description: "Experience excellence in construction with innovative solutions and unmatched quality.",
      image: "residential",
    },
    {
      title: "Crafting Premium",
      highlight: "Spaces",
      description: "From residential dreams to commercial marvels, we bring your vision to life.",
      image: "commercial",
    },
    {
      title: "Engineering the",
      highlight: "Future",
      description: "Industrial-grade construction backed by decades of expertise and innovation.",
      image: "industrial",
    },
  ];

  const stats = [
    { icon: Award, value: "500+", label: "Projects Completed" },
    { icon: Users, value: "200+", label: "Expert Team Members" },
    { icon: Star, value: "98%", label: "Client Satisfaction" },
    { icon: TrendingUp, value: "25+", label: "Years Experience" },
  ];

  const features = [
    {
      title: "Residential Excellence",
      description: "Custom homes designed and built to exceed your expectations with premium finishes.",
    },
    {
      title: "Commercial Mastery",
      description: "State-of-the-art commercial spaces that blend functionality with aesthetic appeal.",
    },
    {
      title: "Industrial Innovation",
      description: "Large-scale industrial projects executed with precision and engineering excellence.",
    },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
  const prevSlide = () =>
    setCurrentSlide((prev) => (prev - 1 + heroSlides.length) % heroSlides.length);

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        {/* Background with gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background/95 to-background/90 z-10" />
        
        {/* Animated background pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: 'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="1"%3E%3Cpath d="M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
          }} />
        </div>

        {/* Content */}
        <div className="container mx-auto px-6 z-20 relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.6 }}
              className="text-center max-w-5xl mx-auto"
            >
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.8 }}
                className="mb-6"
              >
                <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold mb-4 leading-tight">
                  {heroSlides[currentSlide].title}
                  <br />
                  <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent animate-glow">
                    {heroSlides[currentSlide].highlight}
                  </span>
                </h1>
              </motion.div>
              
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.6 }}
                className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-3xl mx-auto"
              >
                {heroSlides[currentSlide].description}
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.6 }}
                className="flex flex-col sm:flex-row gap-4 justify-center"
              >
                <Link to="/projects">
                  <Button
                    size="lg"
                    className="bg-primary hover:bg-primary/90 text-background font-semibold px-8 py-6 text-lg rounded-xl group"
                  >
                    View Our Projects
                    <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
                <Link to="/contact">
                  <Button
                    size="lg"
                    variant="outline"
                    className="glass font-semibold px-8 py-6 text-lg rounded-xl hover:bg-white/10"
                  >
                    Get In Touch
                  </Button>
                </Link>
              </motion.div>
            </motion.div>
          </AnimatePresence>

          {/* Slide Controls */}
          <div className="absolute bottom-12 left-0 right-0 flex items-center justify-center gap-4">
            <button
              onClick={prevSlide}
              className="w-12 h-12 glass rounded-full flex items-center justify-center hover:bg-white/10 transition-all"
              aria-label="Previous slide"
            >
              <ChevronLeft size={20} />
            </button>
            
            <div className="flex gap-2">
              {heroSlides.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentSlide(idx)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    idx === currentSlide ? "w-8 bg-primary" : "w-2 bg-white/30"
                  }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
            
            <button
              onClick={nextSlide}
              className="w-12 h-12 glass rounded-full flex items-center justify-center hover:bg-white/10 transition-all"
              aria-label="Next slide"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 relative">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat, idx) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1, duration: 0.6 }}
              >
                <GlassCard className="text-center">
                  <stat.icon className="w-10 h-10 mx-auto mb-4 text-primary" />
                  <div className="text-4xl font-bold mb-2 text-primary">{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-32 relative">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-6xl font-bold mb-6">
              Our <span className="text-primary">Expertise</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Delivering exceptional results across all construction sectors with innovation and precision.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, idx) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.2, duration: 0.6 }}
              >
                <GlassCard className="h-full">
                  <div className="h-48 bg-gradient-to-br from-primary/20 to-accent/20 rounded-xl mb-6" />
                  <h3 className="text-2xl font-bold mb-3">{feature.title}</h3>
                  <p className="text-muted-foreground mb-6">{feature.description}</p>
                  <Link to="/services" className="text-primary hover:text-primary/80 inline-flex items-center font-medium group">
                    Learn More
                    <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10" />
        <div className="container mx-auto px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="glass-strong rounded-3xl p-12 md:p-20 text-center max-w-4xl mx-auto"
          >
            <h2 className="text-4xl md:text-6xl font-bold mb-6">
              Ready to Build Your Dream?
            </h2>
            <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
              Let's transform your vision into reality with our expert team and proven track record.
            </p>
            <Link to="/contact">
              <Button
                size="lg"
                className="bg-primary hover:bg-primary/90 text-background font-semibold px-12 py-6 text-lg rounded-xl"
              >
                Start Your Project Today
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default Index;
