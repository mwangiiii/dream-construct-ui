import React from "react";
import { motion } from "framer-motion";
import { Layers } from "lucide-react";

const PMStages = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background via-background to-accent/5 p-4 sm:p-6 lg:p-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="flex flex-col items-center"
      >
        <div className="mb-6">
          <Layers className="w-16 h-16 text-primary mx-auto" />
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-3 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent text-center">
          Project Stages
        </h1>
        <p className="text-lg text-muted-foreground text-center max-w-xl mb-8">
          This page will allow you to define, view, and manage the stages of your construction projects. More features coming soon!
        </p>
      </motion.div>
    </div>
  );
};

export default PMStages;
