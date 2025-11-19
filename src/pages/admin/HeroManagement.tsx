import { motion } from "framer-motion";
import { Plus, Trash2, Image as ImageIcon } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";

const HeroManagement = () => {
  // Mock data
  const heroSlides = [
    { id: 1, title: "Building Tomorrow's Landmarks", image: "/placeholder.svg", active: true },
    { id: 2, title: "Crafting Premium Spaces", image: "/placeholder.svg", active: true },
    { id: 3, title: "Engineering the Future", image: "/placeholder.svg", active: true },
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
            <h1 className="text-4xl font-bold mb-2">Hero Slider Management</h1>
            <p className="text-muted-foreground">Manage homepage hero images and content</p>
          </div>
          <Button size="lg" className="gap-2">
            <Plus className="w-4 h-4" />
            Add Slide
          </Button>
        </div>

        {/* Hero Slides Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {heroSlides.map((slide, idx) => (
            <motion.div
              key={slide.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
            >
              <GlassCard>
                <div className="aspect-video bg-muted rounded-lg mb-4 flex items-center justify-center">
                  <ImageIcon className="w-12 h-12 text-muted-foreground" />
                </div>
                <h3 className="font-bold mb-4">{slide.title}</h3>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1">
                    Edit
                  </Button>
                  <Button variant="outline" size="sm" className="text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default HeroManagement;
