import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  delay?: number;
  className?: string;
  isPercentage?: boolean;
}

// Animated number component with count-up effect
function AnimatedNumber({ value, delay = 0 }: { value: number; delay?: number }) {
  const [displayValue, setDisplayValue] = useState(0);
  
  useEffect(() => {
    setDisplayValue(0); // Reset when value changes
    
    let intervalId: NodeJS.Timeout | null = null;
    
    const timer = setTimeout(() => {
      const duration = 1000; // 1 second animation
      const steps = 30;
      const increment = value / steps;
      const stepDuration = duration / steps;
      
      let current = 0;
      intervalId = setInterval(() => {
        current += increment;
        if (current >= value) {
          setDisplayValue(value);
          if (intervalId) clearInterval(intervalId);
        } else {
          setDisplayValue(current);
        }
      }, stepDuration);
    }, delay * 1000);
    
    return () => {
      clearTimeout(timer);
      if (intervalId) clearInterval(intervalId);
    };
  }, [value, delay]);
  
  // Format number appropriately based on value
  if (value < 1) {
    return <>{displayValue.toFixed(1)}</>;
  } else if (value < 10) {
    return <>{displayValue.toFixed(1)}</>;
  } else {
    return <>{Math.round(displayValue)}</>;
  }
}

export function StatCard({ label, value, icon, delay = 0, className, isPercentage = false }: StatCardProps) {
  const isNumber = typeof value === 'number';
  // If value is a string with %, remove it for numeric calculation
  const numericValue = isNumber ? value : parseFloat(String(value).replace('%', ''));
  // Check if percentage: either explicitly set via prop, or string contains %
  const showPercentage = isPercentage || (typeof value === 'string' && value.includes('%'));
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.4, ease: "easeOut" }}
      whileHover={{ scale: 1.02, borderColor: "rgba(255, 255, 255, 0.3)" }}
      className={cn(
        "p-2 lg:p-3 border border-white/10 bg-black/40 backdrop-blur-sm",
        "hover:border-white/20 hover:bg-black/60 transition-all duration-300",
        "relative overflow-hidden",
        className
      )}
    >
      {/* Subtle glow effect on hover */}
      <div className="absolute inset-0 bg-primary/0 hover:bg-primary/5 transition-colors duration-300 pointer-events-none" />
      
      <div className="flex items-center justify-between mb-1 relative z-10">
        <span className="text-[8px] lg:text-[10px] text-muted-foreground uppercase tracking-widest font-mono">
          {label}
        </span>
        <motion.div 
          className="text-white/20"
          animate={{ rotate: [0, 5, -5, 0] }}
          transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
        >
          {icon}
        </motion.div>
      </div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: delay + 0.2, duration: 0.5 }}
        className="text-lg lg:text-xl font-mono font-bold text-primary relative z-10"
      >
        {isNumber && !isNaN(numericValue) ? (
          <>
            <AnimatedNumber value={numericValue} delay={delay + 0.2} />
            {showPercentage && '%'}
          </>
        ) : (
          <>
            {value}
            {showPercentage && !String(value).includes('%') && '%'}
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
