import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}

export const GlassCard = ({ children, className, hover = true }: GlassCardProps) => {
  return (
    <div
      className={cn(
        "glass rounded-2xl p-6",
        hover && "hover-lift hover-glow cursor-pointer",
        className
      )}
    >
      {children}
    </div>
  );
};
