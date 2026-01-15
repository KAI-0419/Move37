import { motion } from "framer-motion";

/**
 * LoadingScreen - Route 전환 시 Suspense fallback으로 사용되는 컴포넌트
 * SplashScreen보다 간단하고 빠르게 표시됨
 */
export function LoadingScreen() {
  return (
    <div
      className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center overflow-hidden"
      role="status"
      aria-live="polite"
      aria-label="Loading content"
    >
      {/* 스피너 */}
      <motion.div
        className="relative w-16 h-16"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        {/* 외부 링 */}
        <motion.div
          className="absolute inset-0 border-4 border-blue-500/30 rounded-full"
          animate={{ rotate: 360 }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "linear",
          }}
        />

        {/* 내부 회전 링 */}
        <motion.div
          className="absolute inset-0 border-4 border-transparent border-t-blue-500 rounded-full"
          animate={{ rotate: 360 }}
          transition={{
            duration: 1,
            repeat: Infinity,
            ease: "linear",
          }}
        />

        {/* 중앙 도트 */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
        >
          <motion.div
            className="w-3 h-3 bg-blue-400 rounded-full"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.7, 1, 0.7],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </motion.div>
      </motion.div>

      {/* 로딩 텍스트 */}
      <motion.div
        className="mt-6 text-blue-400/80 text-sm font-mono tracking-wider"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.3 }}
      >
        LOADING
        <motion.span
          animate={{ opacity: [0, 1, 0] }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          ...
        </motion.span>
      </motion.div>
    </div>
  );
}
