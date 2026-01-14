/**
 * Settings Modal Component
 *
 * Allows users to toggle audio and haptic feedback
 */

import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { X, Volume2, VolumeX, Smartphone } from "lucide-react";
import { GlitchButton } from "@/components/GlitchButton";
import { cn } from "@/lib/utils";
import { audioManager } from "@/lib/audio";
import { useState, useEffect } from "react";

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { t } = useTranslation();
  const [audioEnabled, setAudioEnabled] = useState(audioManager.isAudioEnabled());
  const [hapticsEnabled, setHapticsEnabled] = useState(audioManager.isHapticsEnabled());

  useEffect(() => {
    // Sync with audio manager on mount
    setAudioEnabled(audioManager.isAudioEnabled());
    setHapticsEnabled(audioManager.isHapticsEnabled());
  }, [isOpen]);

  const handleToggleAudio = () => {
    const newValue = !audioEnabled;
    setAudioEnabled(newValue);
    audioManager.setAudioEnabled(newValue);
  };

  const handleToggleHaptics = () => {
    const newValue = !hapticsEnabled;
    setHapticsEnabled(newValue);
    audioManager.setHapticsEnabled(newValue);
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", damping: 20, stiffness: 300 }}
        className="relative w-full max-w-md bg-black/90 border-2 border-primary rounded-lg p-6 space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-primary/30 pb-4">
          <h2 className="text-2xl font-display font-bold text-primary uppercase tracking-wider">
            {t("settings.title", "Settings")}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-primary/10 rounded transition-colors"
            aria-label={t("settings.close", "Close")}
          >
            <X className="w-6 h-6 text-primary" />
          </button>
        </div>

        {/* Settings Options */}
        <div className="space-y-4">
          {/* Audio Toggle */}
          <div className="flex items-center justify-between p-4 bg-black/50 border border-primary/20 rounded">
            <div className="flex items-center gap-3">
              {audioEnabled ? (
                <Volume2 className="w-6 h-6 text-primary" />
              ) : (
                <VolumeX className="w-6 h-6 text-gray-500" />
              )}
              <div>
                <h3 className="font-bold text-white">
                  {t("settings.audio", "Sound Effects")}
                </h3>
                <p className="text-sm text-gray-400">
                  {t("settings.audioDesc", "Game sounds and music")}
                </p>
              </div>
            </div>
            <button
              onClick={handleToggleAudio}
              className={cn(
                "relative w-14 h-8 rounded-full transition-colors",
                audioEnabled ? "bg-primary" : "bg-gray-600"
              )}
              aria-label={t("settings.toggleAudio", "Toggle audio")}
            >
              <motion.div
                className="absolute top-1 w-6 h-6 bg-white rounded-full"
                animate={{ x: audioEnabled ? 30 : 2 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            </button>
          </div>

          {/* Haptics Toggle */}
          <div className="flex items-center justify-between p-4 bg-black/50 border border-primary/20 rounded">
            <div className="flex items-center gap-3">
              <Smartphone className={cn(
                "w-6 h-6",
                hapticsEnabled ? "text-primary" : "text-gray-500"
              )} />
              <div>
                <h3 className="font-bold text-white">
                  {t("settings.haptics", "Haptic Feedback")}
                </h3>
                <p className="text-sm text-gray-400">
                  {t("settings.hapticsDesc", "Vibration feedback")}
                </p>
              </div>
            </div>
            <button
              onClick={handleToggleHaptics}
              className={cn(
                "relative w-14 h-8 rounded-full transition-colors",
                hapticsEnabled ? "bg-primary" : "bg-gray-600"
              )}
              aria-label={t("settings.toggleHaptics", "Toggle haptics")}
            >
              <motion.div
                className="absolute top-1 w-6 h-6 bg-white rounded-full"
                animate={{ x: hapticsEnabled ? 30 : 2 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            </button>
          </div>
        </div>

        {/* Info Text */}
        <div className="text-xs text-gray-500 text-center pt-2">
          {t("settings.info", "Settings are saved automatically")}
        </div>

        {/* Close Button */}
        <GlitchButton
          onClick={onClose}
          variant="primary"
          className="w-full"
        >
          {t("settings.done", "Done")}
        </GlitchButton>

        {/* Decorative corners */}
        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary" />
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-primary" />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary" />
      </motion.div>
    </motion.div>
  );
}
