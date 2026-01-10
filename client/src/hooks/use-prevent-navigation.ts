/**
 * Prevent Navigation Hook
 * 
 * Prevents navigation away from the game page when game is in progress
 */

import { useEffect, useRef } from "react";
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

  // 페이지 이탈 방지: 게임이 진행 중일 때만 확인 창 표시
  useEffect(() => {
    // 게임이 진행 중인지 확인 (게임이 로드되었고, 게임이 종료되지 않았을 때)
    const isGameInProgress = game && !game.winner;

    if (!isGameInProgress) {
      return; // 게임이 종료되었거나 로드되지 않았으면 이벤트 리스너 추가하지 않음
    }

    // 브라우저 탭/창 닫기 또는 새로고침 시 확인 창 표시
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // 최신 브라우저에서는 메시지가 표시되지 않지만, 이벤트를 발생시켜야 확인 창이 표시됨
      e.returnValue = '';
    };

    // 브라우저 뒤로가기 버튼 처리
    const handlePopState = (e: PopStateEvent) => {
      // 게임이 진행 중이고, 사용자가 명시적으로 이동을 허용하지 않았을 때만 확인
      if (isGameInProgress && !isNavigatingAwayRef.current) {
        // popstate는 이미 발생한 후이므로, 즉시 확인 창을 표시하고 취소하면 현재 페이지로 다시 이동
        const confirmed = window.confirm(
          `${t("gameRoom.confirmLeave")}\n\n${t("gameRoom.confirmLeaveSubtext")}`
        );

        if (!confirmed) {
          // 사용자가 취소하면 현재 페이지로 다시 이동 (뒤로가기 취소)
          // Use validated game type to maintain correct URL
          const currentUrl = buildGameRoomUrl(gameType);
          window.history.pushState(null, '', currentUrl);
          // wouter가 경로 변경을 감지하도록 강제로 이벤트 발생
          window.dispatchEvent(new PopStateEvent('popstate'));
        } else {
          // 사용자가 확인하면 이동 허용
          isNavigatingAwayRef.current = true;
        }
      }
    };

    // 현재 상태를 히스토리에 추가하여 popstate 이벤트를 감지할 수 있도록 함
    // 이미 pushState가 되어 있으면 다시 추가하지 않음
    // Use validated game type to maintain correct URL
    if (window.location.pathname === '/game') {
      const currentUrl = buildGameRoomUrl(gameType);
      window.history.pushState(null, '', currentUrl);
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [game, gameType, isNavigatingAwayRef]);

  // 경로 변경 감지: /game에서 다른 경로로 변경되려고 할 때 확인 창 표시
  // 이는 브라우저 뒤로가기 버튼이나 다른 라우팅 변경을 감지하기 위함
  useEffect(() => {
    // 게임이 진행 중이고, 경로가 /game에서 다른 경로로 변경된 경우
    const isGameInProgress = game && !game.winner;
    const currentGameUrl = buildGameRoomUrl(gameType);
    const wasOnGamePage = prevLocationRef.current.startsWith('/game');
    const isLeavingGamePage = !location.startsWith('/game');

    if (
      isGameInProgress &&
      wasOnGamePage &&
      isLeavingGamePage &&
      !isNavigatingAwayRef.current
    ) {
      // 경로가 이미 변경된 경우, 확인 창을 표시하고 취소하면 다시 게임 페이지로 이동
      const confirmed = window.confirm(
        `${t("gameRoom.confirmLeave")}\n\n${t("gameRoom.confirmLeaveSubtext")}`
      );

      if (!confirmed) {
        // 사용자가 취소하면 다시 게임 페이지로 이동 (gameType 포함)
        isNavigatingAwayRef.current = true; // 무한 루프 방지
        setLocation(currentGameUrl);
        // 다음 렌더링 사이클에서 다시 false로 설정
        setTimeout(() => {
          isNavigatingAwayRef.current = false;
        }, 0);
      } else {
        // 사용자가 확인하면 이동 허용
        isNavigatingAwayRef.current = true;
      }
    }

    // 현재 경로를 이전 경로로 저장
    prevLocationRef.current = location;
  }, [location, game, gameType, setLocation, isNavigatingAwayRef, t]);

  // 라우팅 변경 시 확인 창 표시를 위한 핸들러
  const handleNavigateAway = (targetPath: string) => {
    // 게임이 진행 중인지 확인
    const isGameInProgress = game && !game.winner;

    if (isGameInProgress && !isNavigatingAwayRef.current) {
      const confirmed = window.confirm(
        `${t("gameRoom.confirmLeave")}\n\n${t("gameRoom.confirmLeaveSubtext")}`
      );

      if (!confirmed) {
        return; // 사용자가 취소하면 이동하지 않음
      }
    }

    // 확인했거나 게임이 종료되었으면 이동
    isNavigatingAwayRef.current = true;
    setLocation(targetPath);
  };

  return {
    handleNavigateAway,
  };
}
