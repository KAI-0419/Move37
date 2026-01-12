import { useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { admobService } from "@/lib/admob";
import { StatusBar, Style } from "@capacitor/status-bar";
import { Capacitor } from "@capacitor/core";
import NotFound from "@/pages/not-found";
import Lobby from "@/pages/Lobby";
import GameRoom from "@/pages/GameRoom";

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
  useEffect(() => {
    // 하이브리드 앱 초기 설정
    const initNativeFeatures = async () => {
      if (!Capacitor.isNativePlatform()) return;

      try {
        // StatusBar 설정: 검은색 배경에 밝은 텍스트
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: "#000000" });
      } catch (error) {
        console.error('Failed to set StatusBar:', error);
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
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
