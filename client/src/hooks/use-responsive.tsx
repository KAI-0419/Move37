import { useState, useEffect } from "react";

/**
 * Tailwind CSS 브레이크포인트 기준
 * sm: 640px
 * md: 768px
 * lg: 1024px
 * xl: 1280px
 */
const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

/**
 * 현재 화면 크기에 따라 반응형 값을 반환하는 훅
 * @returns 현재 화면 크기 정보 및 브레이크포인트 상태
 */
export function useResponsive() {
  const [windowWidth, setWindowWidth] = useState<number>(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth;
    }
    return BREAKPOINTS.lg; // SSR 기본값: 데스크톱
  });

  useEffect(() => {
    // 초기 렌더링 시 정확한 값 설정
    const updateWidth = () => {
      setWindowWidth(window.innerWidth);
    };

    // 즉시 실행하여 초기 값 설정
    updateWidth();

    // 디바운싱을 통한 성능 최적화
    let timeoutId: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(updateWidth, 100); // 디바운싱으로 불필요한 리렌더링 방지
    };

    window.addEventListener("resize", handleResize);
    
    // Cleanup
    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(timeoutId);
    };
  }, []);

  return {
    width: windowWidth,
    isMobile: windowWidth < BREAKPOINTS.sm, // < 640px
    isTablet: windowWidth >= BREAKPOINTS.sm && windowWidth < BREAKPOINTS.lg, // 640px - 1023px
    isDesktop: windowWidth >= BREAKPOINTS.lg, // >= 1024px
    isSmallMobile: windowWidth < BREAKPOINTS.sm, // < 640px
    isLargeTablet: windowWidth >= BREAKPOINTS.md && windowWidth < BREAKPOINTS.lg, // 768px - 1023px
    breakpoint: getBreakpoint(windowWidth),
  };
}

/**
 * 현재 너비에 해당하는 브레이크포인트 반환
 */
function getBreakpoint(width: number): Breakpoint {
  if (width >= BREAKPOINTS.xl) return "xl";
  if (width >= BREAKPOINTS.lg) return "lg";
  if (width >= BREAKPOINTS.md) return "md";
  if (width >= BREAKPOINTS.sm) return "sm";
  return "sm"; // 기본값
}

/**
 * 캐러셀에서 보여줄 카드 수를 계산하는 헬퍼 함수
 * @param width 현재 화면 너비
 * @returns 보여줄 카드 수
 */
export function getCardsToShow(width: number): number {
  if (width < BREAKPOINTS.sm) {
    // 모바일: 1개 카드 (전체 너비)
    return 1;
  } else if (width < BREAKPOINTS.md) {
    // 작은 태블릿: 1.5개 (peek 효과)
    return 1.5;
  } else if (width < BREAKPOINTS.lg) {
    // 태블릿: 2개 카드
    return 2;
  } else {
    // 데스크톱: 3개 카드
    return 3;
  }
}
