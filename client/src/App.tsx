import { useEffect, useState } from "react";
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
import Lobby from "@/pages/Lobby";
import GameRoom from "@/pages/GameRoom";
import { SplashScreen } from "@/components/SplashScreen";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Lobby} />
      <Route path="/game" component={GameRoom} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [showSplash, setShowSplash] = useState(true);

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

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        {showSplash ? (
          <SplashScreen onFinish={() => setShowSplash(false)} />
        ) : (
          <Router />
        )}
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
