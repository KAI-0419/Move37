/**
 * Settings Modal Component
 *
 * Allows users to toggle audio and haptic feedback
 */

import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { X, Volume2, VolumeX, Smartphone, Languages, ChevronDown } from "lucide-react";
import { GlitchButton } from "@/components/GlitchButton";
import { cn } from "@/lib/utils";
import { audioManager, GAME_SOUNDS } from "@/lib/audio";
import { useState, useEffect, useRef } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedLanguage?: "ko" | "en";
  onLanguageChange?: (language: "ko" | "en") => void;
}

export function SettingsModal({ isOpen, onClose, selectedLanguage = "ko", onLanguageChange }: SettingsModalProps) {
  const { t } = useTranslation();
  const [audioEnabled, setAudioEnabled] = useState(audioManager.isAudioEnabled());
  const [hapticsEnabled, setHapticsEnabled] = useState(audioManager.isHapticsEnabled());
  const [testingSoundButton, setTestingSoundButton] = useState(false);
  const [testingHapticsButton, setTestingHapticsButton] = useState(false);
  const languageTriggerRef = useRef<HTMLButtonElement>(null);
  const [dropdownWidth, setDropdownWidth] = useState<number | undefined>(undefined);

  useEffect(() => {
    // Sync with audio manager on mount
    setAudioEnabled(audioManager.isAudioEnabled());
    setHapticsEnabled(audioManager.isHapticsEnabled());
  }, [isOpen]);

  // Sync language changes when modal opens or props change
  useEffect(() => {
    // Language is managed by parent component, no need for internal state
  }, [selectedLanguage, isOpen]);

  // Measure trigger width for dropdown to match button size
  useEffect(() => {
    if (languageTriggerRef.current) {
      const updateWidth = () => {
        if (languageTriggerRef.current) {
          setDropdownWidth(languageTriggerRef.current.offsetWidth);
        }
      };

      // Measure immediately
      updateWidth();

      // Also measure after a small delay to ensure rendering is complete
      const timeoutId = setTimeout(updateWidth, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [isOpen, selectedLanguage]);

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

  const handleTestSound = async () => {
    setTestingSoundButton(true);
    try {
      await audioManager.playSound(GAME_SOUNDS.BUTTON_CLICK.id, 0.8);
    } catch (error) {
      console.error('Test sound failed:', error);
    } finally {
      setTimeout(() => setTestingSoundButton(false), 500);
    }
  };

  const handleTestHaptics = async () => {
    setTestingHapticsButton(true);
    try {
      await audioManager.vibrate('medium');
    } catch (error) {
      console.error('Test haptics failed:', error);
    } finally {
      setTimeout(() => setTestingHapticsButton(false), 500);
    }
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
                  {t("settings.audio", "SOUND")}
                </h3>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Test Sound Button */}
              <button
                onClick={handleTestSound}
                disabled={!audioEnabled || testingSoundButton}
                className={cn(
                  "px-3 py-1 text-xs border rounded transition-colors",
                  audioEnabled
                    ? "border-primary/40 text-primary hover:bg-primary/10"
                    : "border-gray-600 text-gray-500 cursor-not-allowed"
                )}
                aria-label={t("settings.testSound", "Test sound")}
              >
                {testingSoundButton ? "..." : t("settings.test", "Test")}
              </button>
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
                  {t("settings.haptics", "HAPTIC")}
                </h3>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Test Haptics Button */}
              <button
                onClick={handleTestHaptics}
                disabled={!hapticsEnabled || testingHapticsButton}
                className={cn(
                  "px-3 py-1 text-xs border rounded transition-colors",
                  hapticsEnabled
                    ? "border-primary/40 text-primary hover:bg-primary/10"
                    : "border-gray-600 text-gray-500 cursor-not-allowed"
                )}
                aria-label={t("settings.testHaptics", "Test haptics")}
              >
                {testingHapticsButton ? "..." : t("settings.test", "Test")}
              </button>
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

          {/* Language Settings */}
          <div className="flex items-center justify-between p-4 bg-black/50 border border-primary/20 rounded">
            <div className="flex items-center gap-3">
              <Languages className="w-6 h-6 text-primary" />
              <div>
                <h3 className="font-bold text-white">
                  {t("settings.language", "Language")}
                </h3>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  ref={languageTriggerRef}
                  className="flex items-center gap-2 px-3 py-2 bg-black/50 border border-primary/20 rounded text-sm text-white hover:border-primary/40 transition-colors min-w-[100px] justify-between"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span>{selectedLanguage === "ko" ? "한국어" : "English"}</span>
                  <ChevronDown className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                sideOffset={5}
                className="bg-black/95 border-white/10 backdrop-blur-sm"
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: dropdownWidth ? `${dropdownWidth}px` : undefined,
                  minWidth: dropdownWidth ? `${dropdownWidth}px` : '100px',
                  zIndex: 9999
                }}
              >
                <DropdownMenuItem
                  onClick={() => onLanguageChange?.("en")}
                  className="cursor-pointer focus:bg-primary/10 focus:text-primary data-[highlighted]:bg-primary/10 data-[highlighted]:text-primary"
                >
                  English
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onLanguageChange?.("ko")}
                  className="cursor-pointer focus:bg-primary/10 focus:text-primary data-[highlighted]:bg-primary/10 data-[highlighted]:text-primary"
                >
                  한국어
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
