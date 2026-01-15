import { useEffect, useState, lazy, Suspense } from "react";
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
import { LoadingScreen } from "@/components/LoadingScreen";
import { GameEngineFactory } from "@/lib/games/GameEngineFactory";
import { GameUIFactory } from "@/lib/games/GameUIFactory";
import type { GameType } from "@shared/schema";

// Route-based code splitting: 각 페이지를 별도 청크로 분리
const Lobby = lazy(() => import("@/pages/Lobby"));
const GameRoom = lazy(() => import("@/pages/GameRoom"));

function Router() {
  return (
    <Suspense fallback={<LoadingScreen />}>
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

  // Preload all game engines, UI components, and page components on app start
  useEffect(() => {
    const preloadGames = async () => {
      const gameTypes: GameType[] = ["MINI_CHESS", "GAME_2", "GAME_3"];

      // Preload everything in parallel:
      // 1. Game engines and UI components
      // 2. Page components (Lobby and GameRoom)
      await Promise.all([
        // Preload game engines and UI
        ...gameTypes.flatMap(gameType => [
          GameEngineFactory.getEngine(gameType).catch(err =>
            console.error(`Failed to preload engine for ${gameType}:`, err)
          ),
          GameUIFactory.getBoardComponent(gameType).catch(err =>
            console.error(`Failed to preload UI for ${gameType}:`, err)
          ),
        ]),
        // Preload page components to avoid showing LoadingScreen
        import("@/pages/Lobby").catch(err =>
          console.error('Failed to preload Lobby:', err)
        ),
        import("@/pages/GameRoom").catch(err =>
          console.error('Failed to preload GameRoom:', err)
        ),
      ]);

      console.log('All game engines, UI components, and pages preloaded');
      setIsGamesReady(true);
    };

    preloadGames();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        {showSplash ? (
          <SplashScreen onFinish={() => setIsSplashFinished(true)} />
        ) : (
          <Router />
        )}
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
