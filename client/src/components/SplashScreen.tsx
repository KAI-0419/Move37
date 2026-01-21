import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useCallback, useRef } from "react";
import { Scanlines } from "./Scanlines";
import { useAdaptiveScale, clampSize, clampSpacing } from "../hooks/use-adaptive-scale";

interface SplashScreenProps {
  onFinish: () => void;
}

// 디자인 토큰 및 상수 정의
const DESIGN_TOKENS = {
  colors: {
    primary: {
      blue: {
        400: "rgb(96, 165, 250)",
        500: "rgb(59, 130, 246)",
        600: "rgb(37, 99, 235)",
      },
    },
    accent: {
      green: "rgb(74, 222, 128)",
      cyan: "rgb(6, 182, 212)",
      red: "rgb(239, 68, 68)",
    },
  },
  opacity: {
    grid: 0.2,
    connections: 0.3,
    corners: 0.3,
    glow: 0.8,
    text: {
      primary: 0.6,
      secondary: 0.4,
      tertiary: 0.5,
    },
  },
  sizes: {
    grid: {
      lines: 20,
      spacing: 5,
    },
    neural: {
      nodes: 30,
      maxDistance: 25,
      nodeSize: {
        min: 1,
        max: 4,
      },
    },
    corners: {
      size: 16,
      glowSize: 20,
    },
  },
  timing: {
    stages: {
      init: 200,    // 메인 요소 등장
      fade: 1200,   // 페이드 아웃 준비
      minDuration: 1600, // 최소 스플래시 시간 (사용자 경험 최적화)
    },
    animations: {
      gridDelay: 0.05,
      gridDuration: 0.8,
      neuralDelay: 0.3,
      cornerDelay: 0.1,
      cornerDuration: 0.5,
      loadingDuration: 0.4,
      glitchRepeatDelay: 4,
    },
  },
} as const;

// 부팅 시퀀스 메시지
const BOOT_MESSAGES = [
  { text: "INITIALIZING SYSTEMS...", delay: 0 },
  { text: "LOADING NEURAL MATRICES...", delay: 400 },
  { text: "LOADING AI MODELS...", delay: 800 },
  { text: "SYSTEM READY", delay: 1400 },
] as const;

// 타입 정의
interface Node {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly delay: number;
  readonly duration: number;
}

interface Connection {
  readonly from: number;
  readonly to: number;
  readonly opacity: number;
}

// 최적화된 파티클 노드 생성 (시드 기반으로 일관된 랜덤 값 생성)
const generateNodes = (() => {
  // 시드를 사용한 일관된 랜덤 함수
  const seededRandom = (seed: number) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };

  return (count: number): readonly Node[] => {
    return Array.from({ length: count }, (_, i) => {
      const seedX = i * 1.618; // 황금비 사용으로 더 자연스러운 분포
      const seedY = i * 2.718;
      const seedSize = i * 3.141;
      const seedDelay = i * 1.414;
      const seedDuration = i * 0.618;

      return {
        id: i,
        x: seededRandom(seedX) * 100,
        y: seededRandom(seedY) * 100,
        size: seededRandom(seedSize) * (DESIGN_TOKENS.sizes.neural.nodeSize.max - DESIGN_TOKENS.sizes.neural.nodeSize.min) + DESIGN_TOKENS.sizes.neural.nodeSize.min,
        delay: seededRandom(seedDelay) * 2,
        duration: seededRandom(seedDuration) * 3 + 2,
      } as const;
    });
  };
})();

// 최적화된 연결선 생성 (거리 기반 연결 + 성능 개선)
const generateConnections = (nodes: readonly Node[]): readonly Connection[] => {
  const connections: Connection[] = [];
  const maxDistance = DESIGN_TOKENS.sizes.neural.maxDistance;

  // 거리 기반 연결 최적화 - 가까운 노드만 연결
  for (let i = 0; i < nodes.length; i++) {
    // 각 노드당 최대 연결 수 제한 (성능 최적화)
    let connectionsForNode = 0;
    const maxConnectionsPerNode = 3;

    for (let j = i + 1; j < nodes.length && connectionsForNode < maxConnectionsPerNode; j++) {
      const dx = nodes[i].x - nodes[j].x;
      const dy = nodes[i].y - nodes[j].y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < maxDistance) {
        connections.push({
          from: i,
          to: j,
          opacity: Math.max(0, 1 - distance / maxDistance) * DESIGN_TOKENS.opacity.connections,
        } as const);
        connectionsForNode++;
      }
    }
  }

  return connections;
};

// 그리드 라인 컴포넌트 - 메모이제이션 적용
const GridBackground = (() => {
  // 그리드 라인 데이터를 미리 계산 (성능 최적화)
  const gridLines = Array.from({ length: DESIGN_TOKENS.sizes.grid.lines }, (_, i) => ({
    index: i,
    position: `${(i + 1) * DESIGN_TOKENS.sizes.grid.spacing}%`,
    delay: i * DESIGN_TOKENS.timing.animations.gridDelay,
  }));

  return function GridBackground() {
    return (
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ opacity: DESIGN_TOKENS.opacity.grid }}
        role="presentation"
        aria-hidden="true"
      >
        {/* 수평 그리드 라인 */}
        {gridLines.map((line) => (
          <motion.div
            key={`h-${line.index}`}
            className="absolute left-0 right-0 h-px"
            style={{
              top: line.position,
              background: `linear-gradient(to right, transparent, ${DESIGN_TOKENS.colors.primary.blue[500]}80, transparent)`,
            }}
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{
              delay: line.delay,
              duration: DESIGN_TOKENS.timing.animations.gridDuration,
              ease: [0.25, 0.46, 0.45, 0.94],
            }}
          />
        ))}

        {/* 수직 그리드 라인 */}
        {gridLines.map((line) => (
          <motion.div
            key={`v-${line.index}`}
            className="absolute top-0 bottom-0 w-px"
            style={{
              left: line.position,
              background: `linear-gradient(to bottom, transparent, ${DESIGN_TOKENS.colors.primary.blue[500]}80, transparent)`,
            }}
            initial={{ opacity: 0, scaleY: 0 }}
            animate={{ opacity: 1, scaleY: 1 }}
            transition={{
              delay: line.delay,
              duration: DESIGN_TOKENS.timing.animations.gridDuration,
              ease: [0.25, 0.46, 0.45, 0.94],
            }}
          />
        ))}
      </div>
    );
  };
})();

// 뉴럴 네트워크 파티클 시스템 - 완전 메모이제이션 및 최적화
const NeuralNetwork = (() => {
  // 한 번만 계산되는 노드와 연결선 데이터
  const nodes = generateNodes(DESIGN_TOKENS.sizes.neural.nodes);
  const connections = generateConnections(nodes);

  return function NeuralNetwork() {
    return (
      <div
        className="absolute inset-0 overflow-hidden"
        role="presentation"
        aria-hidden="true"
      >
        <svg
          className="w-full h-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{ filter: "drop-shadow(0 0 2px rgba(59, 130, 246, 0.2))" }}
        >
          {/* 연결선 - 배치별 렌더링 최적화 */}
          {connections.map((conn) => (
            <motion.line
              key={`conn-${conn.from}-${conn.to}`}
              x1={`${nodes[conn.from].x}%`}
              y1={`${nodes[conn.from].y}%`}
              x2={`${nodes[conn.to].x}%`}
              y2={`${nodes[conn.to].y}%`}
              stroke={DESIGN_TOKENS.colors.primary.blue[500]}
              strokeWidth="0.08"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: conn.opacity }}
              transition={{
                delay: 0.5,
                duration: 1.5,
                ease: [0.25, 0.46, 0.45, 0.94],
              }}
            />
          ))}

          {/* 노드 - 사이즈와 애니메이션 최적화 */}
          {nodes.map((node) => (
            <motion.circle
              key={`node-${node.id}`}
              cx={`${node.x}%`}
              cy={`${node.y}%`}
              r={node.size * 0.12}
              fill={DESIGN_TOKENS.colors.primary.blue[400]}
              initial={{ opacity: 0, scale: 0 }}
              animate={{
                opacity: [0, DESIGN_TOKENS.opacity.glow, DESIGN_TOKENS.opacity.connections],
                scale: [0, 1.1, 1],
              }}
              transition={{
                delay: node.delay * DESIGN_TOKENS.timing.animations.neuralDelay,
                duration: node.duration,
                repeat: Infinity,
                repeatType: "reverse" as const,
                ease: [0.25, 0.46, 0.45, 0.94],
              }}
            />
          ))}
        </svg>
      </div>
    );
  };
})();

// 부팅 메시지 컴포넌트 - 타이밍 체계화 및 접근성 향상
function BootSequence({ stage }: { stage: number }) {
  const [visibleMessages, setVisibleMessages] = useState<readonly number[]>([]);
  const { fontSize, vhToPx, device } = useAdaptiveScale();

  useEffect(() => {
    if (stage >= 1) {
      const timers = BOOT_MESSAGES.map((msg, i) => {
        return setTimeout(() => {
          setVisibleMessages((prev) => [...prev, i]);
        }, msg.delay);
      });

      return () => {
        timers.forEach(clearTimeout);
      };
    }
  }, [stage]);

  // 반응형 위치 계산 (화면 하단에서 적절한 간격)
  const bottomPosition = device.isSmallScreen ? vhToPx(18) : vhToPx(16);

  return (
    <div
      className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 font-mono"
      style={{
        bottom: `${bottomPosition}px`,
        fontSize: clampSize(8, 10, 1.2),
        willChange: "transform",
        transform: "translate3d(-50%, 0, 0)",
      }}
      role="status"
      aria-live="polite"
      aria-label="System boot sequence"
    >
      {BOOT_MESSAGES.map((msg, i) => {
        const isVisible = visibleMessages.includes(i);
        const isLastMessage = i === BOOT_MESSAGES.length - 1;

        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 5 }}
            animate={isVisible ? { opacity: 1, y: 0 } : {}}
            transition={{
              duration: 0.4,
              ease: [0.25, 0.46, 0.45, 0.94],
            }}
            className={`tracking-wider ${isLastMessage
                ? `text-[${DESIGN_TOKENS.colors.accent.green}]`
                : `text-[${DESIGN_TOKENS.colors.primary.blue[400]}]`
              }`}
            style={{
              color: isLastMessage
                ? DESIGN_TOKENS.colors.accent.green
                : `${DESIGN_TOKENS.colors.primary.blue[400]}${Math.round(DESIGN_TOKENS.opacity.text.primary * 255).toString(16).padStart(2, '0')}`,
            }}
          >
            {isVisible && (
              <>
                <span
                  className="text-blue-500/40"
                  style={{
                    color: `${DESIGN_TOKENS.colors.primary.blue[500]}${Math.round(DESIGN_TOKENS.opacity.text.secondary * 255).toString(16).padStart(2, '0')}`,
                  }}
                >
                  [{String(i).padStart(2, "0")}]
                </span>{" "}
                <span aria-live="assertive">{msg.text}</span>
                {isLastMessage && (
                  <motion.span
                    animate={{ opacity: [1, 1, 0, 0] }}
                    transition={{
                      duration: 0.8,
                      repeat: Infinity,
                      ease: "linear",
                      times: [0, 0.5, 0.5, 1], // steps(1) 효과를 keyframes로 구현
                    }}
                    aria-hidden="true"
                  >
                    _
                  </motion.span>
                )}
              </>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

// 애니메이션 코너 장식 - 메모이제이션 및 최적화
const AnimatedCorners = (() => {
  const cornerVariants = {
    initial: { scale: 0, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    exit: { scale: 1.5, opacity: 0 },
  } as const;

  const corners = [
    {
      position: "top-8 left-8",
      border: "border-t-2 border-l-2",
      dotPosition: "-top-0.5 -left-0.5",
      delay: 0,
    },
    {
      position: "top-8 right-8",
      border: "border-t-2 border-r-2",
      dotPosition: "-top-0.5 -right-0.5",
      delay: 1,
    },
    {
      position: "bottom-8 left-8",
      border: "border-b-2 border-l-2",
      dotPosition: "-bottom-0.5 -left-0.5",
      delay: 2,
    },
    {
      position: "bottom-8 right-8",
      border: "border-b-2 border-r-2",
      dotPosition: "-bottom-0.5 -right-0.5",
      delay: 3,
    },
  ] as const;

  return function AnimatedCorners({ stage }: { stage: number }) {
    return (
      <>
        {corners.map((corner, i) => (
          <motion.div
            key={i}
            className={`absolute ${corner.position}`}
            style={{
              width: DESIGN_TOKENS.sizes.corners.size,
              height: DESIGN_TOKENS.sizes.corners.size,
            }}
            variants={cornerVariants}
            initial="initial"
            animate={stage >= 1 ? "animate" : "initial"}
            exit="exit"
            transition={{
              delay: corner.delay * DESIGN_TOKENS.timing.animations.cornerDelay,
              duration: DESIGN_TOKENS.timing.animations.cornerDuration,
              ease: [0.25, 0.46, 0.45, 0.94],
            }}
            role="presentation"
            aria-hidden="true"
          >
            {/* 외곽 프레임 */}
            <div
              className={`absolute inset-0 ${corner.border}`}
              style={{
                borderColor: `${DESIGN_TOKENS.colors.primary.blue[500]}${Math.round(DESIGN_TOKENS.opacity.corners * 255).toString(16).padStart(2, '0')}`,
              }}
            />

            {/* 내부 글로우 프레임 */}
            <motion.div
              className={`absolute inset-2 ${corner.border}`}
              style={{
                borderColor: DESIGN_TOKENS.colors.primary.blue[400],
              }}
              animate={{
                opacity: [
                  DESIGN_TOKENS.opacity.corners,
                  DESIGN_TOKENS.opacity.glow,
                  DESIGN_TOKENS.opacity.corners
                ]
              }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                delay: corner.delay * 0.25,
                ease: [0.25, 0.46, 0.45, 0.94],
              }}
            />

            {/* 코너 도트 */}
            <motion.div
              className={`absolute w-1.5 h-1.5 rounded-full ${corner.dotPosition}`}
              style={{
                backgroundColor: DESIGN_TOKENS.colors.primary.blue[400],
              }}
              animate={{
                boxShadow: [
                  `0 0 4px ${DESIGN_TOKENS.colors.primary.blue[400]}80`,
                  `0 0 12px ${DESIGN_TOKENS.colors.primary.blue[400]}CC`,
                  `0 0 4px ${DESIGN_TOKENS.colors.primary.blue[400]}80`,
                ],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: [0.25, 0.46, 0.45, 0.94],
              }}
            />
          </motion.div>
        ))}
      </>
    );
  };
})();

// 향상된 로딩 바 - 시간 기반 자연스러운 퍼센트 계산 및 최적화
function EnhancedLoadingBar({ stage }: { stage: number }) {
  const [elapsedTime, setElapsedTime] = useState(0);
  const { fontSize, vhToPx, vwToPx, device, responsive } = useAdaptiveScale();

  // 시간 기반 로딩 퍼센트 계산 - 800ms 동안 자연스럽게 증가
  const getProgressPercentage = useCallback((currentStage: number, timeElapsed: number): number => {
    const totalDuration = 800; // 로딩 바 전용 타이밍 (800ms)

    if (currentStage === 0) return 0;
    if (currentStage === 2) return 100;

    // 유효성 검사: timeElapsed가 유효한 숫자인지 확인
    if (!Number.isFinite(timeElapsed) || timeElapsed < 0) {
      return 0;
    }

    // 스테이지 1에서는 시간에 따라 자연스럽게 증가 (0% ~ 95%)
    // easing 함수를 적용하여 더 자연스러운 진행
    const progress = Math.min(timeElapsed / totalDuration, 1);
    const easedProgress = progress < 0.5
      ? 2 * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 2) / 2;

    // NaN 방지를 위한 추가 검사
    const result = Math.round(easedProgress * 95);
    return Number.isFinite(result) ? result : 0;
  }, []);

  // 타이머로 경과 시간 추적
  useEffect(() => {
    if (stage === 0) {
      setElapsedTime(0);
      return;
    }

    const startTime = Date.now();
    const timer = setInterval(() => {
      const currentElapsed = Date.now() - startTime;
      setElapsedTime(currentElapsed);

      // 로딩 바 타이밍(1300ms)이 지나면 타이머 정지 (동적 종료는 상위 컴포넌트에서 처리)
      if (currentElapsed >= 1300) {
        clearInterval(timer);
      }
    }, 16); // 60fps

    return () => clearInterval(timer);
  }, [stage]);

  const percentage = Math.max(0, Math.min(100, getProgressPercentage(stage, elapsedTime) || 0));
  const progressWidth = `${percentage}%`;

  // 반응형 위치 및 크기 계산
  const bottomPosition = device.isSmallScreen ? vhToPx(14) : vhToPx(12);
  const barWidth = responsive({
    mobile: vwToPx(70),   // 70% of viewport width on mobile
    tablet: vwToPx(50),   // 50% on tablet
    desktop: 280,         // Fixed 280px on desktop
    default: vwToPx(60),
  });

  return (
    <div
      className="absolute left-1/2 -translate-x-1/2"
      style={{
        bottom: `${bottomPosition}px`,
        width: `${barWidth}px`,
        willChange: "transform",
        transform: "translate3d(-50%, 0, 0)",
      }}
      role="progressbar"
      aria-valuenow={percentage}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`System loading progress: ${percentage}% complete`}
    >
      {/* 로딩 바 배경 */}
      <div
        className="relative h-[3px] overflow-hidden rounded-full"
        style={{
          backgroundColor: `rgba(255, 255, 255, ${DESIGN_TOKENS.opacity.text.tertiary * 0.3})`,
        }}
      >
        {/* 메인 프로그레스 */}
        <motion.div
          initial={{ width: "0%" }}
          animate={{ width: progressWidth }}
          transition={{
            duration: DESIGN_TOKENS.timing.animations.loadingDuration,
            ease: [0.25, 0.46, 0.45, 0.94],
          }}
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            background: `linear-gradient(to right, ${DESIGN_TOKENS.colors.primary.blue[600]}, ${DESIGN_TOKENS.colors.primary.blue[400]}, ${DESIGN_TOKENS.colors.primary.blue[600]})`,
          }}
        />

        {/* 글로우 오버레이 - 퍼센트에 따라 속도 조절 */}
        <motion.div
          className="absolute inset-y-0 w-20"
          style={{
            background: `linear-gradient(to right, transparent, rgba(255, 255, 255, ${DESIGN_TOKENS.opacity.glow}), transparent)`,
          }}
          animate={{ x: ["-100%", "400%"] }}
          transition={{
            duration: percentage === 100 ? 0.8 : 2,
            repeat: percentage === 100 ? 0 : Infinity,
            ease: "linear",
          }}
        />
      </div>

      {/* 로딩 퍼센트 */}
      <motion.div
        className="mt-2 text-center font-mono tracking-widest font-bold"
        style={{
          fontSize: clampSize(10, 14, 1.5),
          color: DESIGN_TOKENS.colors.primary.blue[400],
          textShadow: `0 0 8px ${DESIGN_TOKENS.colors.primary.blue[500]}80`,
          willChange: "opacity",
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.3 }}
      >
        <motion.span
          animate={{
            opacity: [0.7, 1, 0.7],
            scale: [0.95, 1, 0.95]
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: [0.25, 0.46, 0.45, 0.94],
          }}
        >
          {percentage}
        </motion.span>
        % LOADED
      </motion.div>
    </div>
  );
}

// 글리치 효과 래퍼 - 최적화 및 자연스러운 효과
const GlitchWrapper = (() => {
  // 글리치 효과를 위한 상수들
  const GLITCH_CONFIG = {
    primary: {
      duration: 0.15,
      repeatDelay: DESIGN_TOKENS.timing.animations.glitchRepeatDelay,
      // keyframes를 사용한 단계적 애니메이션
      keyframes: {
        x: [0, -1.5, 0, 1.5, 0] as number[],
        filter: [
          'hue-rotate(0deg)',
          'hue-rotate(8deg)',
          'hue-rotate(0deg)',
          'hue-rotate(-8deg)',
          'hue-rotate(0deg)'
        ] as string[],
      },
    },
    red: {
      duration: 0.08,
      x: [0, 3, 0] as number[],
      clipPath: "inset(25% 0 50% 0)",
      color: DESIGN_TOKENS.colors.accent.red,
      // keyframes를 사용한 단계적 애니메이션
      keyframes: {
        opacity: [0, 0, 0.4, 0.4, 0] as number[],
        x: [0, 0, 3, 3, 0] as number[],
      },
    },
    cyan: {
      duration: 0.08,
      x: [0, -3, 0] as number[],
      clipPath: "inset(50% 0 25% 0)",
      color: DESIGN_TOKENS.colors.accent.cyan,
      delay: 0.03,
      // keyframes를 사용한 단계적 애니메이션
      keyframes: {
        opacity: [0, 0, 0.4, 0.4, 0] as number[],
        x: [0, 0, -3, -3, 0] as number[],
      },
    },
  };

  return function GlitchWrapper({ children }: { children: React.ReactNode }) {
    return (
      <motion.div
        className="relative"
        animate={GLITCH_CONFIG.primary.keyframes}
        transition={{
          duration: GLITCH_CONFIG.primary.duration,
          repeat: Infinity,
          repeatDelay: GLITCH_CONFIG.primary.repeatDelay,
          ease: "linear", // keyframes와 함께 사용하여 단계적 효과
          times: [0, 0.25, 0.5, 0.75, 1], // 4단계로 나누어 steps 효과 구현
        }}
        role="presentation"
        aria-hidden="true"
      >
        {children}

        {/* 글리치 복제본들 - keyframes를 사용한 단계적 애니메이션 */}
        <motion.div
          className="absolute inset-0"
          style={{
            clipPath: GLITCH_CONFIG.red.clipPath,
          }}
          animate={GLITCH_CONFIG.red.keyframes}
          transition={{
            duration: GLITCH_CONFIG.red.duration,
            repeat: Infinity,
            repeatDelay: GLITCH_CONFIG.primary.repeatDelay,
            ease: "linear", // keyframes와 함께 사용하여 단계적 효과
            times: [0, 0.25, 0.5, 0.75, 1], // 4단계로 나누어 steps 효과 구현
          }}
        >
          <div
            style={{
              color: `${GLITCH_CONFIG.red.color}99`, // 60% opacity
            }}
          >
            {children}
          </div>
        </motion.div>

        <motion.div
          className="absolute inset-0"
          style={{
            clipPath: GLITCH_CONFIG.cyan.clipPath,
          }}
          animate={GLITCH_CONFIG.cyan.keyframes}
          transition={{
            duration: GLITCH_CONFIG.cyan.duration,
            repeat: Infinity,
            repeatDelay: GLITCH_CONFIG.primary.repeatDelay,
            delay: GLITCH_CONFIG.cyan.delay,
            ease: "linear", // keyframes와 함께 사용하여 단계적 효과
            times: [0, 0.25, 0.5, 0.75, 1], // 4단계로 나누어 steps 효과 구현
          }}
        >
          <div
            style={{
              color: `${GLITCH_CONFIG.cyan.color}99`, // 60% opacity
            }}
          >
            {children}
          </div>
        </motion.div>
      </motion.div>
    );
  };
})();

export function SplashScreen({ onFinish }: SplashScreenProps) {
  const [stage, setStage] = useState(0);
  const { fontSize, safeArea, device } = useAdaptiveScale();

  // onFinish 콜백을 ref로 관리하여 이펙트 의존성 제거 (불필요한 리렌더링/재시작 방지)
  const onFinishRef = useRef(onFinish);
  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  useEffect(() => {
    const startTime = Date.now();

    // 스테이지별 애니메이션 타이밍 제어
    const timer1 = setTimeout(() => setStage(1), DESIGN_TOKENS.timing.stages.init); // 메인 요소 등장

    // 페이드 아웃 준비는 최소 시간 이후에만 시작
    const minFadeTime = DESIGN_TOKENS.timing.stages.minDuration * 0.75; // 600ms
    const timer2 = setTimeout(() => setStage(2), Math.max(DESIGN_TOKENS.timing.stages.init, minFadeTime));

    // 종료 타이밍은 동적으로 계산: 최소 시간 보장하되 로딩 완료 즉시 종료
    const calculateFinishTime = () => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, DESIGN_TOKENS.timing.stages.minDuration - elapsed);
      return remaining;
    };

    // finish 콜백을 동적으로 실행할 수 있도록 함수로 래핑
    const finishSplash = () => {
      const finishTime = calculateFinishTime();
      setTimeout(() => {
        if (onFinishRef.current) {
          onFinishRef.current();
        }
      }, finishTime);
    };

    // 타이머3는 finish 콜백을 위한 것
    const timer3 = setTimeout(finishSplash, 0);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []); // 빈 의존성 배열: 컴포넌트 마운트 시 한 번만 실행됨을 보장

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center overflow-hidden font-display"
      style={{
        paddingTop: `${safeArea.top}px`,
        paddingBottom: `${safeArea.bottom}px`,
        paddingLeft: `${safeArea.left}px`,
        paddingRight: `${safeArea.right}px`,
        willChange: "contents",
      }}
      role="status"
      aria-live="polite"
      aria-label="System initialization in progress"
    >
      {/* 배경 레이어들 - 성능 최적화된 순서 */}
      <GridBackground />
      <NeuralNetwork />
      <Scanlines />

      {/* 중앙 글로우 효과 - 최적화된 애니메이션 */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at center, ${DESIGN_TOKENS.colors.primary.blue[600]}4D, ${DESIGN_TOKENS.colors.primary.blue[500]}1A, transparent)`,
          willChange: "opacity",
          transform: "translate3d(0, 0, 0)",
        }}
        animate={{
          opacity: [
            DESIGN_TOKENS.opacity.corners,
            DESIGN_TOKENS.opacity.glow,
            DESIGN_TOKENS.opacity.corners
          ]
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: [0.25, 0.46, 0.45, 0.94],
        }}
        role="presentation"
        aria-hidden="true"
      />

      {/* 메인 로고 컨테이너 */}
      <AnimatePresence mode="wait">
        {stage < 2 && (
          <motion.div
            // CSS 초기 상태로 숨김 - Framer Motion 초기화 전 깜빡임 방지
            style={{ opacity: 0, transform: "scale(0.9)" }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{
              opacity: 0,
              scale: 1.1,
              filter: "blur(30px) brightness(2)",
              transition: {
                delay: 0.4, // 로딩 바와 부팅 시퀀스가 사라진 후 0.4초 뒤에 로고 사라짐
                duration: 0.8,
                ease: [0.4, 0, 0.2, 1]
              }
            }}
            transition={{
              duration: 0.8,
              ease: [0.16, 1, 0.3, 1]
            }}
            className="relative flex flex-col items-center z-10"
            role="banner"
            aria-label="Move 37 Logo"
          >
            <GlitchWrapper>
              {/* MOVE 37 텍스트 로고 */}
              <motion.div
                className="flex flex-col items-center font-display leading-none"
                initial={{ x: -10, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.8 }}
                style={{
                  willChange: "transform, opacity",
                  transform: "translate3d(0, 0, 0)",
                }}
              >
                <span
                  className="font-black tracking-tighter text-white uppercase"
                  style={{
                    fontSize: clampSize(40, 72, 7),
                  }}
                >
                  MOVE
                  <span className="text-blue-500 ml-1">37</span>
                </span>
                <span
                  className="text-blue-300/60 uppercase tracking-[0.3em] mt-1 font-mono"
                  style={{
                    fontSize: clampSize(8, 12, 1.2),
                  }}
                >
                  Pure Logic Engine
                </span>
              </motion.div>
            </GlitchWrapper>
          </motion.div>
        )}
      </AnimatePresence>


      {/* 부팅 시퀀스 */}
      <BootSequence stage={stage} />

      {/* 향상된 로딩 바 */}
      <EnhancedLoadingBar stage={stage} />

      {/* 하단 버전 정보 - 접근성 향상 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: DESIGN_TOKENS.opacity.text.secondary, y: 0 }}
        transition={{
          delay: 1.8,
          duration: 0.5,
          ease: [0.25, 0.46, 0.45, 0.94],
        }}
        className="absolute tracking-[0.2em] font-mono flex items-center gap-2"
        style={{
          bottom: `${safeArea.bottom + 24}px`,
          fontSize: clampSize(7, 9, 1),
          color: `${DESIGN_TOKENS.colors.primary.blue[400]}${Math.round(DESIGN_TOKENS.opacity.text.secondary * 255).toString(16).padStart(2, '0')}`,
          willChange: "transform, opacity",
          transform: "translate3d(0, 0, 0)",
        }}
        role="contentinfo"
        aria-label="System version information"
      >
        <motion.span
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: DESIGN_TOKENS.colors.accent.green }}
          animate={{
            opacity: [
              DESIGN_TOKENS.opacity.text.secondary,
              1,
              DESIGN_TOKENS.opacity.text.secondary
            ]
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: [0.25, 0.46, 0.45, 0.94],
          }}
          aria-hidden="true"
        />
        <span>NEXUS CORE v0.9.1</span>
      </motion.div>
    </div>
  );
}
