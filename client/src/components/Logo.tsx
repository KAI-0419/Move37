import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl" | number;
  variant?: "icon" | "full" | "vertical";
  glow?: boolean;
}

export function Logo({ 
  className, 
  size = "md", 
  variant = "full",
  glow = true 
}: LogoProps) {
  const sizeMap = {
    sm: 32,
    md: 48,
    lg: 64,
    xl: 120,
  };

  const pixelSize = typeof size === "number" ? size : sizeMap[size];

  const iconAnimation = {
    initial: { rotate: -10, opacity: 0, scale: 0.8 },
    animate: { rotate: 0, opacity: 1, scale: 1 },
    transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] }
  };

  const textAnimation = {
    initial: { x: -10, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    transition: { delay: 0.2, duration: 0.8 }
  };

  const Icon = () => (
    <motion.div 
      className="relative flex-shrink-0"
      style={{ width: pixelSize, height: pixelSize }}
      {...iconAnimation}
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn(
          "w-full h-full drop-shadow-2xl",
          glow && "drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]"
        )}
      >
        {/* SVG Filter for Glow */}
        <defs>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Outer Hexagon Frame */}
        <path
          d="M50 5 L90 27.5 V72.5 L50 95 L10 72.5 V27.5 Z"
          className="stroke-blue-500/30"
          strokeWidth="1"
        />
        
        {/* Inner Hexagon with Glow */}
        <motion.path
          d="M50 12 L83 31 V69 L50 88 L17 69 V31 Z"
          className="stroke-blue-500"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
        />

        {/* Connection Nodes (Neural Network feel) */}
        <motion.circle cx="50" cy="12" r="2" fill="white" animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 2, repeat: Infinity }} />
        <motion.circle cx="83" cy="31" r="2" fill="white" animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 2, repeat: Infinity, delay: 0.3 }} />
        <motion.circle cx="83" cy="69" r="2" fill="white" animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 2, repeat: Infinity, delay: 0.6 }} />
        <motion.circle cx="50" cy="88" r="2" fill="white" animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 2, repeat: Infinity, delay: 0.9 }} />
        <motion.circle cx="17" cy="69" r="2" fill="white" animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 2, repeat: Infinity, delay: 1.2 }} />
        <motion.circle cx="17" cy="31" r="2" fill="white" animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 2, repeat: Infinity, delay: 1.5 }} />

        {/* Center Number "37" */}
        <text
          x="50"
          y="62"
          textAnchor="middle"
          className="fill-white font-display font-black"
          style={{ fontSize: '38px' }}
        >
          37
        </text>
      </svg>
    </motion.div>
  );

  if (variant === "icon") {
    return <div className={cn("inline-flex items-center", className)}><Icon /></div>;
  }

  return (
    <div className={cn(
      "inline-flex items-center",
      variant === "vertical" ? "flex-col gap-4" : "gap-4",
      className
    )}>
      <Icon />
      <motion.div 
        className={cn(
          "flex flex-col font-display leading-none",
          variant === "vertical" ? "items-center text-center" : "items-start"
        )}
        {...textAnimation}
      >
        <span 
          className={cn(
            "font-black tracking-tighter text-white uppercase",
            pixelSize >= 120 ? "text-6xl" : pixelSize >= 64 ? "text-4xl" : "text-2xl"
          )}
        >
          MOVE
          <span className="text-blue-500 ml-1">37</span>
        </span>
        {pixelSize >= 64 && (
          <span className="text-[10px] text-blue-300/60 uppercase tracking-[0.3em] mt-1 font-mono">
            Pure Logic Engine
          </span>
        )}
      </motion.div>
    </div>
  );
}
