import { useState, useEffect, useMemo } from "react";

/**
 * 기준 화면 크기 (iPhone SE - 가장 작은 현대 아이폰)
 * 모든 스케일링은 이 크기를 기준으로 계산됩니다
 */
const BASE_DIMENSIONS = {
  width: 375,   // iPhone SE width
  height: 812,  // iPhone X-style height (safe area 포함)
} as const;

/**
 * 기기 카테고리별 스케일 제약
 */
const SCALE_CONSTRAINTS = {
  minScale: 0.7,   // 최소 70% 크기 (매우 작은 화면)
  maxScale: 2.0,   // 최대 200% 크기 (매우 큰 화면)
  mobile: {
    min: 0.8,
    max: 1.2,
  },
  tablet: {
    min: 1.2,
    max: 1.8,
  },
  desktop: {
    min: 1.5,
    max: 2.0,
  },
} as const;

/**
 * 기기 타입 감지
 */
interface DeviceInfo {
  type: "mobile" | "tablet" | "desktop";
  isSmallScreen: boolean;    // < 375px
  isLargeScreen: boolean;    // >= 1024px
  isPortrait: boolean;
  isLandscape: boolean;
  hasNotch: boolean;         // Safe area top > 20px
}

/**
 * 스케일 정보
 */
interface ScaleInfo {
  // 기본 스케일 팩터
  scale: number;
  scaleX: number;  // 가로 기준 스케일
  scaleY: number;  // 세로 기준 스케일

  // Viewport 정보
  vw: number;      // 1vw in pixels
  vh: number;      // 1vh in pixels

  // Safe area 정보 (픽셀)
  safeArea: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };

  // 기기 정보
  device: DeviceInfo;

  // 헬퍼 함수들
  fontSize: (baseSize: number) => number;
  spacing: (baseSpacing: number) => number;
  size: (baseSize: number) => number;
  vwToPx: (vw: number) => number;
  vhToPx: (vh: number) => number;

  // Responsive value selector
  responsive: <T,>(values: {
    mobile?: T;
    tablet?: T;
    desktop?: T;
    default: T;
  }) => T;
}

/**
 * Safe area inset 값을 가져오는 함수
 */
function getSafeAreaInsets() {
  if (typeof window === "undefined" || !window.getComputedStyle) {
    return { top: 0, bottom: 0, left: 0, right: 0 };
  }

  const computedStyle = window.getComputedStyle(document.documentElement);

  const parsePx = (value: string): number => {
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
  };

  return {
    top: parsePx(computedStyle.getPropertyValue("padding-top")),
    bottom: parsePx(computedStyle.getPropertyValue("padding-bottom")),
    left: parsePx(computedStyle.getPropertyValue("padding-left")),
    right: parsePx(computedStyle.getPropertyValue("padding-right")),
  };
}

/**
 * 기기 정보를 감지하는 함수
 */
function detectDevice(width: number, height: number, safeAreaTop: number): DeviceInfo {
  const isPortrait = height > width;
  const hasNotch = safeAreaTop > 20;

  let type: DeviceInfo["type"] = "mobile";
  if (width >= 1024) {
    type = "desktop";
  } else if (width >= 768) {
    type = "tablet";
  }

  return {
    type,
    isSmallScreen: width < BASE_DIMENSIONS.width,
    isLargeScreen: width >= 1024,
    isPortrait,
    isLandscape: !isPortrait,
    hasNotch,
  };
}

/**
 * 스케일 팩터를 계산하는 함수
 * 화면 크기와 기기 타입에 따라 적절한 스케일을 반환합니다
 */
function calculateScale(
  width: number,
  height: number,
  deviceType: DeviceInfo["type"]
): { scale: number; scaleX: number; scaleY: number } {
  // 가로/세로 각각의 스케일 계산
  const scaleX = width / BASE_DIMENSIONS.width;
  const scaleY = height / BASE_DIMENSIONS.height;

  // 두 스케일 중 작은 값을 기본으로 사용 (화면에 맞추기 위해)
  let scale = Math.min(scaleX, scaleY);

  // 기기 타입별 제약 적용
  const constraints = SCALE_CONSTRAINTS[deviceType];
  scale = Math.max(constraints.min, Math.min(constraints.max, scale));

  // 전체 제약 적용
  scale = Math.max(
    SCALE_CONSTRAINTS.minScale,
    Math.min(SCALE_CONSTRAINTS.maxScale, scale)
  );

  return { scale, scaleX, scaleY };
}

/**
 * 동적 스케일링을 제공하는 Hook
 *
 * 모든 기기에서 일관된 비율과 크기를 유지하면서
 * 각 기기에 최적화된 레이아웃을 제공합니다.
 *
 * @returns {ScaleInfo} 스케일 정보 및 헬퍼 함수들
 *
 * @example
 * ```tsx
 * const { scale, fontSize, spacing, responsive } = useAdaptiveScale();
 *
 * // 기본 스케일 적용
 * <div style={{ fontSize: fontSize(16) }}>Text</div>
 *
 * // 간격 적용
 * <div style={{ marginBottom: spacing(20) }}>Content</div>
 *
 * // 반응형 값
 * const columns = responsive({
 *   mobile: 1,
 *   tablet: 2,
 *   desktop: 3,
 *   default: 1
 * });
 * ```
 */
export function useAdaptiveScale(): ScaleInfo {
  const [dimensions, setDimensions] = useState(() => {
    if (typeof window === "undefined") {
      return {
        width: BASE_DIMENSIONS.width,
        height: BASE_DIMENSIONS.height,
      };
    }
    return {
      width: window.innerWidth,
      height: window.innerHeight,
    };
  });

  const [safeArea, setSafeArea] = useState(() => getSafeAreaInsets());

  // 화면 크기 변경 감지
  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
      setSafeArea(getSafeAreaInsets());
    };

    // 초기 실행
    updateDimensions();

    // 디바운싱으로 성능 최적화
    let timeoutId: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(updateDimensions, 100);
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", updateDimensions);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", updateDimensions);
      clearTimeout(timeoutId);
    };
  }, []);

  // 스케일 정보 계산 (메모이제이션)
  const scaleInfo = useMemo<ScaleInfo>(() => {
    const { width, height } = dimensions;

    // 기기 정보 감지
    const device = detectDevice(width, height, safeArea.top);

    // 스케일 계산
    const { scale, scaleX, scaleY } = calculateScale(width, height, device.type);

    // Viewport 단위 계산
    const vw = width / 100;
    const vh = height / 100;

    // 헬퍼 함수들
    const fontSize = (baseSize: number) => Math.round(baseSize * scale);
    const spacing = (baseSpacing: number) => Math.round(baseSpacing * scale);
    const size = (baseSize: number) => Math.round(baseSize * scale);
    const vwToPx = (vwValue: number) => vwValue * vw;
    const vhToPx = (vhValue: number) => vhValue * vh;

    const responsive = <T,>(values: {
      mobile?: T;
      tablet?: T;
      desktop?: T;
      default: T;
    }): T => {
      if (device.type === "desktop" && values.desktop !== undefined) {
        return values.desktop;
      }
      if (device.type === "tablet" && values.tablet !== undefined) {
        return values.tablet;
      }
      if (device.type === "mobile" && values.mobile !== undefined) {
        return values.mobile;
      }
      return values.default;
    };

    return {
      scale,
      scaleX,
      scaleY,
      vw,
      vh,
      safeArea,
      device,
      fontSize,
      spacing,
      size,
      vwToPx,
      vhToPx,
      responsive,
    };
  }, [dimensions, safeArea]);

  return scaleInfo;
}

/**
 * Viewport 기반 크기 계산 유틸리티
 */
export const viewport = {
  /**
   * Viewport width 기반 크기 (예: vw(5) = "5vw")
   */
  vw: (value: number) => `${value}vw`,

  /**
   * Viewport height 기반 크기 (예: vh(10) = "10vh")
   */
  vh: (value: number) => `${value}vh`,

  /**
   * Dynamic viewport height (모바일에서 주소창 고려)
   */
  dvh: (value: number) => `${value}dvh`,

  /**
   * 최소값 (예: vmin(5) = "5vmin")
   */
  vmin: (value: number) => `${value}vmin`,

  /**
   * 최대값 (예: vmax(5) = "5vmax")
   */
  vmax: (value: number) => `${value}vmax`,
};

/**
 * 반응형 크기를 위한 clamp 유틸리티
 * CSS clamp() 함수를 생성합니다
 *
 * @example
 * ```tsx
 * // 16px ~ 24px 범위에서 viewport에 따라 조정
 * fontSize: clampSize(16, 24, 1.5)
 * // 결과: "clamp(16px, 1.5vw, 24px)"
 * ```
 */
export function clampSize(min: number, max: number, preferredVw: number): string {
  return `clamp(${min}px, ${preferredVw}vw, ${max}px)`;
}

/**
 * 반응형 간격을 위한 clamp 유틸리티 (vh 기반)
 */
export function clampSpacing(min: number, max: number, preferredVh: number): string {
  return `clamp(${min}px, ${preferredVh}vh, ${max}px)`;
}
