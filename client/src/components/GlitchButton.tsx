import { motion } from "framer-motion";
import { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface GlitchButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "destructive" | "outline";
}

export function GlitchButton({ 
  children, 
  className, 
  variant = "primary", 
  disabled,
  ...props 
}: GlitchButtonProps) {
  
  const variants = {
    primary: "bg-primary text-black border-primary hover:bg-primary/90",
    secondary: "bg-secondary text-black border-secondary hover:bg-secondary/90",
    destructive: "bg-destructive text-white border-destructive hover:bg-destructive/90",
    outline: "bg-transparent text-primary border-primary hover:bg-primary/10"
  };

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "relative px-8 py-3 font-display font-bold uppercase tracking-wider border-2 transition-all duration-200",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "group overflow-hidden",
        variants[variant],
        className
      )}
      disabled={disabled}
      {...props}
    >
      <span className="relative z-10">{children}</span>
      
      {/* Glitch Overlay Effect */}
      {!disabled && (
        <div className="absolute inset-0 translate-y-full group-hover:translate-y-0 transition-transform duration-200 bg-white/20 z-0 mix-blend-overlay" />
      )}
      
      {/* Decorative corners */}
      <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-current opacity-50" />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-current opacity-50" />
    </motion.button>
  );
}
