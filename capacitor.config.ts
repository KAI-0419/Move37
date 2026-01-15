import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.move37.app',
  appName: 'Move 37',
  webDir: 'dist/public',
  bundledWebRuntime: false,
  plugins: {
    AdMob: {
      androidAppId: 'ca-app-pub-3972245990721813~9364898203',
      // 이 ID들은 테스트용입니다. 실제 출시 시 실제 AdMob 앱 ID로 교체해야 합니다.
      iosAppId: 'ca-app-pub-3940256099942544~1458002511'
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#000000',
      overlaysWebView: false
    },
    SplashScreen: {
      // Native splash screen duration (3 seconds)
      launchShowDuration: 3000,
      launchAutoHide: true,

      // Background color (consistent with React splash)
      backgroundColor: "#000000",

      // Android: CENTER_CROP works well with vector drawables
      // iOS: scaleAspectFit set in LaunchScreen.storyboard
      androidScaleType: "CENTER_CROP",

      // No spinner - custom loading bar in React component
      showSpinner: false,

      // Fullscreen splash (hides status/navigation bars)
      splashFullScreen: true,
      splashImmersive: true,

      // Android resource name (default: splash)
      // iOS: uses Splash image from Assets.xcassets
      androidSplashResourceName: "splash",
    },
    Haptics: {},
    NativeAudio: {}
  }
};

export default config;
