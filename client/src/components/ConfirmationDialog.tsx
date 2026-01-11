/**
 * Confirmation Dialog Component
 * 
 * A themed dialog for critical game actions (like surrender)
 */

import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { GlitchButton } from "@/components/GlitchButton";
import { cn } from "@/lib/utils";
import { Scanlines } from "@/components/Scanlines";

export interface ConfirmationDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmText: string;
  cancelText: string;
  onConfirm: () => void;
  onCancel: () => void;
  difficultyColors: {
    borderOpacity: string;
    textOpacity: string;
    bgOpacity: string;
    bgHover: string;
  };
}

export function ConfirmationDialog({
  isOpen,
  title,
  description,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
  difficultyColors,
}: ConfirmationDialogProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />

          {/* Dialog Content */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className={cn(
              "relative w-full max-w-md bg-background border-2 p-6 md:p-8 shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden",
              difficultyColors.borderOpacity
            )}
          >
            <Scanlines />
            
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className={cn("mb-4 p-3 rounded-full bg-black/20", difficultyColors.textOpacity)}>
                <AlertTriangle className="w-12 h-12" />
              </div>

              <h2 className="text-2xl md:text-3xl font-display font-black tracking-tighter mb-2 uppercase italic">
                {title}
              </h2>

              <p className="text-muted-foreground font-mono text-sm md:text-base mb-8 leading-relaxed">
                {description}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                <GlitchButton
                  variant="outline"
                  onClick={onCancel}
                  className="w-full text-xs py-3"
                >
                  {cancelText}
                </GlitchButton>
                
                <GlitchButton
                  variant="primary"
                  onClick={onConfirm}
                  className={cn(
                    "w-full text-xs py-3",
                    difficultyColors.bgOpacity,
                    difficultyColors.textOpacity
                  )}
                >
                  {confirmText}
                </GlitchButton>
              </div>
            </div>

            {/* Decorative elements */}
            <div className="absolute top-0 right-0 p-2 opacity-20 font-mono text-[10px] select-none pointer-events-none">
              SECURE_PROMPT_V1.0
            </div>
            <div className="absolute bottom-0 left-0 p-2 opacity-20 font-mono text-[10px] select-none pointer-events-none">
              TERMINATE_SESSION?
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
