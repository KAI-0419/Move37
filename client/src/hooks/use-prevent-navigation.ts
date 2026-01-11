/**
 * Prevent Navigation Hook
 * 
 * Prevents navigation away from the game page when game is in progress
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import type { Game } from "@shared/schema";
import { buildGameRoomUrl } from "@/lib/routing";
import type { GameType } from "@shared/schema";

export interface UsePreventNavigationOptions {
  game: Game | null | undefined;
  gameType: GameType;
  isNavigatingAwayRef: React.MutableRefObject<boolean>;
  t: (key: string) => string;
}

/**
 * Hook to prevent navigation away from game page when game is in progress
 */
export function usePreventNavigation({
  game,
  gameType,
  isNavigatingAwayRef,
  t,
}: UsePreventNavigationOptions) {
  const [location, setLocation] = useLocation();
  const prevLocationRef = useRef(location);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  // 브라우저 탭/창 닫기 또는 새로고침 시 확인 창 표시 (이 부분은 브라우저 기본 시스템 창을 사용해야 함)
  useEffect(() => {
    const isGameInProgress = game && !game.winner;
    if (!isGameInProgress) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [game]);

  // 라우팅 변경 시 확인 창 표시를 위한 핸들러
  const handleNavigateAway = useCallback((targetPath: string) => {
    const isGameInProgress = game && !game.winner;

    if (isGameInProgress && !isNavigatingAwayRef.current) {
      setPendingPath(targetPath);
      setIsConfirmOpen(true);
      return;
    }

    isNavigatingAwayRef.current = true;
    setLocation(targetPath);
  }, [game, isNavigatingAwayRef, setLocation]);

  const confirmNavigation = useCallback(() => {
    if (pendingPath) {
      isNavigatingAwayRef.current = true;
      setLocation(pendingPath);
    } else {
      // If no pending path but confirmed (e.g. from back button), 
      // we allow the next navigation event
      isNavigatingAwayRef.current = true;
      window.history.back();
    }
    setIsConfirmOpen(false);
    setPendingPath(null);
  }, [pendingPath, isNavigatingAwayRef, setLocation]);

  const cancelNavigation = useCallback(() => {
    setIsConfirmOpen(false);
    setPendingPath(null);
    
    // 만약 URL이 이미 변경된 상태라면 (뒤로가기 등), 원래 URL로 복구
    const currentUrl = buildGameRoomUrl(gameType);
    if (window.location.pathname !== currentUrl) {
      window.history.pushState(null, '', currentUrl);
    }
  }, [gameType]);

  // 브라우저 뒤로가기 버튼 처리
  useEffect(() => {
    const isGameInProgress = game && !game.winner;
    if (!isGameInProgress) return;

    const handlePopState = (e: PopStateEvent) => {
      if (isGameInProgress && !isNavigatingAwayRef.current) {
        // 뒤로가기를 감지하면 다이얼로그를 띄우고 히스토리를 복구
        setIsConfirmOpen(true);
        setPendingPath(null); // 뒤로가기는 특정 경로가 아닌 히스토리 이동임
        
        const currentUrl = buildGameRoomUrl(gameType);
        window.history.pushState(null, '', currentUrl);
      }
    };

    // 현재 상태를 히스토리에 추가하여 popstate 이벤트를 감지할 수 있도록 함
    if (window.location.pathname.startsWith('/game')) {
      const currentUrl = buildGameRoomUrl(gameType);
      if (window.history.state !== 'game-state') {
        window.history.replaceState('game-state', '', currentUrl);
        window.history.pushState(null, '', currentUrl);
      }
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [game, gameType, isNavigatingAwayRef]);

  // wouter의 경로 변경 감지 (Link 컴포넌트나 직접 setLocation 호출 시)
  useEffect(() => {
    const isGameInProgress = game && !game.winner;
    const wasOnGamePage = prevLocationRef.current.startsWith('/game');
    const isLeavingGamePage = !location.startsWith('/game');

    if (
      isGameInProgress &&
      wasOnGamePage &&
      isLeavingGamePage &&
      !isNavigatingAwayRef.current
    ) {
      // 경로가 변경되려고 할 때 다이얼로그 표시 및 경로 복구
      setPendingPath(location);
      setIsConfirmOpen(true);
      
      const currentGameUrl = buildGameRoomUrl(gameType);
      isNavigatingAwayRef.current = true; // 복구 시 무한 루프 방지
      setLocation(currentGameUrl);
      
      setTimeout(() => {
        isNavigatingAwayRef.current = false;
      }, 0);
    }

    prevLocationRef.current = location;
  }, [location, game, gameType, setLocation, isNavigatingAwayRef]);

  return {
    handleNavigateAway,
    isConfirmOpen,
    confirmNavigation,
    cancelNavigation,
  };
}
