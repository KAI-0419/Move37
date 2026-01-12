import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { Scanlines } from "./Scanlines";
import { Logo } from "./Logo";

interface SplashScreenProps {
  onFinish: () => void;
}

export function SplashScreen({ onFinish }: SplashScreenProps) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    // 스테이지별 애니메이션 타이밍 제어
    const timer1 = setTimeout(() => setStage(1), 500); // 메인 요소 등장
    const timer2 = setTimeout(() => setStage(2), 2200); // 페이드 아웃 시작
    const timer3 = setTimeout(() => onFinish(), 3000); // 종료

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [onFinish]);

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center overflow-hidden font-display">
      <Scanlines />
      
      {/* 배경 글로우 효과 */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-transparent opacity-60" />

      <AnimatePresence mode="wait">
        {stage < 2 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ 
              opacity: 0, 
              scale: 1.05, 
              filter: "blur(20px)",
              transition: { duration: 0.8, ease: "easeInOut" } 
            }}
            transition={{ duration: 1 }}
            className="relative flex flex-col items-center"
          >
            <Logo variant="vertical" size="xl" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 모서리 장식 요소 (UI 디테일) */}
      <div className="absolute top-10 left-10 w-12 h-12 border-t border-l border-blue-500/40" />
      <div className="absolute top-10 right-10 w-12 h-12 border-t border-r border-blue-500/40" />
      <div className="absolute bottom-10 left-10 w-12 h-12 border-b border-l border-blue-500/40" />
      <div className="absolute bottom-10 right-10 w-12 h-12 border-b border-r border-blue-500/40" />

      {/* 하단 로딩 바 */}
      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 w-48 h-[2px] bg-white/5 overflow-hidden">
        <motion.div 
          initial={{ x: "-100%" }}
          animate={{ x: "0%" }}
          transition={{ duration: 2.5, ease: "easeInOut" }}
          className="w-full h-full bg-gradient-to-r from-transparent via-blue-500 to-transparent"
        />
      </div>

      {/* 하단 버전 정보 */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.3 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-8 text-[8px] text-white tracking-widest font-mono"
      >
        SYSTEM v0.9.1 BETA // INITIALIZING NEURAL NETWORK
      </motion.div>
    </div>
  );
}
