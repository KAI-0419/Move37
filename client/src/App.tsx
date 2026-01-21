import { useEffect, useState, lazy, Suspense, useCallback } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { admobService } from "@/lib/admob";
import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen as NativeSplashScreen } from "@capacitor/splash-screen";
import { Capacitor } from "@capacitor/core";
import NotFound from "@/pages/not-found";
import { SplashScreen } from "@/components/SplashScreen";
import { GameEngineFactory } from "@/lib/games/GameEngineFactory";
import { GameUIFactory } from "@/lib/games/GameUIFactory";
import type { GameType } from "@shared/schema";

// requestIdleCallback 폴백 - 모바일 브라우저 호환성
const requestIdleCallback = (typeof window !== 'undefined' && window.requestIdleCallback) ||
  function (callback: (deadline: { timeRemaining: () => number; didTimeout: boolean }) => void, options?: { timeout?: number }) {
    const start = Date.now();
    return setTimeout(() => {
      callback({
        timeRemaining: () => Math.max(0, 50 - (Date.now() - start)), // 50ms 남은 시간 시뮬레이션
        didTimeout: false
      });
    }, options?.timeout || 1);
  };

const cancelIdleCallback = (typeof window !== 'undefined' && window.cancelIdleCallback) ||
  function (id: number) {
    clearTimeout(id);
  };

// Route-based code splitting: 각 페이지를 별도 청크로 분리
const Lobby = lazy(() => import("@/pages/Lobby"));
const GameRoom = lazy(() => import("@/pages/GameRoom"));

function Router() {
  return (
    <Suspense fallback={null}>
      <Switch>
        <Route path="/" component={Lobby} />
        <Route path="/game" component={GameRoom} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  const [isSplashFinished, setIsSplashFinished] = useState(false);
  const [isGamesReady, setIsGamesReady] = useState(false);

  // Splash Screen은 두 조건이 모두 만족될 때까지 유지:
  // 1. Splash 애니메이션이 완료되었고 (isSplashFinished)
  // 2. 게임이 모두 준비되었을 때 (isGamesReady)
  const showSplash = !isSplashFinished || !isGamesReady;

  useEffect(() => {
    // 하이브리드 앱 초기 설정
    const initNativeFeatures = async () => {
      if (!Capacitor.isNativePlatform()) {
        // 웹 브라우저에서도 스플래시가 보이도록 설정 (테스트 용도)
        return;
      }

      try {
        // StatusBar 설정: 검은색 배경에 밝은 텍스트
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: "#000000" });

        // 네이티브 스플래시 화면을 숨기고 커스텀 프론트엔드 스플래시로 전환
        // 애니메이션 연결을 위해 즉시 숨김
        await NativeSplashScreen.hide();
      } catch (error) {
        console.error('Failed to set native features:', error);
      }

      // AdMob 초기화
      try {
        await admobService.initialize();
      } catch (error) {
        console.error('Failed to initialize AdMob:', error);
      }
    };

    initNativeFeatures();
  }, []);

  // Smart 3-stage preloading system for optimal UX
  useEffect(() => {
    const loadCriticalResources = async () => {
      // Stage 1: Critical resources (during splash screen)
      // Only load the Lobby page that's immediately visible to the user
      await import("@/pages/Lobby").catch(err =>
        console.error('Failed to preload Lobby:', err)
      );
      console.log('Critical resources loaded');
      setIsGamesReady(true);
    };

    const loadHighPriorityResources = async () => {
      // Stage 2: High priority resources (right after splash screen)
      // Load the most commonly played game (MINI_CHESS) and GameRoom page
      await Promise.all([
        GameEngineFactory.getEngine("MINI_CHESS").catch(err =>
          console.error(`Failed to preload MINI_CHESS engine:`, err)
        ),
        GameUIFactory.getBoardComponent("MINI_CHESS").catch(err =>
          console.error(`Failed to preload MINI_CHESS UI:`, err)
        ),
        import("@/pages/GameRoom").catch(err =>
          console.error('Failed to preload GameRoom:', err)
        ),
      ]);
      console.log('High priority resources loaded');
    };

    const loadLowPriorityResources = async () => {
      // Stage 3: Low priority resources (during idle time)
      // Load remaining games in background
      const remainingGames: GameType[] = ["GAME_2", "GAME_3"];
      await Promise.all(
        remainingGames.flatMap(gameType => [
          GameEngineFactory.getEngine(gameType).catch(err =>
            console.error(`Failed to preload engine for ${gameType}:`, err)
          ),
          GameUIFactory.getBoardComponent(gameType).catch(err =>
            console.error(`Failed to preload UI for ${gameType}:`, err)
          ),
        ])
      );
      console.log('Low priority resources loaded');
    };

    // Start with critical resources
    loadCriticalResources();

    // Load high priority resources right after splash screen ends
    // Use requestIdleCallback for better performance
    const highPriorityTimer = setTimeout(() => {
      requestIdleCallback(() => {
        loadHighPriorityResources();
      });
    }, 100); // Small delay to ensure splash screen transition completes

    // Load low priority resources during idle time
    const lowPriorityTimer = setTimeout(() => {
      requestIdleCallback(() => {
        loadLowPriorityResources();
      }, { timeout: 5000 }); // Don't wait too long, max 5 seconds
    }, 500); // Wait a bit longer to prioritize user interactions

    return () => {
      clearTimeout(highPriorityTimer);
      clearTimeout(lowPriorityTimer);
    };
  }, []);

  const handleSplashFinish = useCallback(() => {
    setIsSplashFinished(true);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        {showSplash ? (
          <SplashScreen onFinish={handleSplashFinish} />
        ) : (
          <Router />
        )}
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
