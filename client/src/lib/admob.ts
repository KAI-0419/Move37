import {
  AdMob,
  BannerAdOptions,
  BannerAdSize,
  BannerAdPosition,
  AdMobBannerSize,
  InterstitialAdOptions,
  RewardAdOptions,
  AdmobConsentStatus,
} from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';

export class AdMobService {
  private static instance: AdMobService;
  private initialized = false;

  private constructor() {}

  public static getInstance(): AdMobService {
    if (!AdMobService.instance) {
      AdMobService.instance = new AdMobService();
    }
    return AdMobService.instance;
  }

  /**
   * AdMob 초기화
   */
  public async initialize(): Promise<void> {
    if (this.initialized || !Capacitor.isNativePlatform()) {
      return;
    }

    try {
      await AdMob.initialize();
      
      // 사용자 동의 추적 (iOS 14+)
      const { status } = await AdMob.getTrackingAuthorizationStatus();
      
      if (status === 'notDetermined') {
        await AdMob.requestTrackingAuthorization();
      }

      this.initialized = true;
      console.log('AdMob initialized successfully');
    } catch (error) {
      console.error('AdMob initialization failed', error);
    }
  }

  /**
   * 배너 광고 표시
   */
  public async showBanner(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    const options: BannerAdOptions = {
      adId: Capacitor.getPlatform() === 'ios' 
        ? 'ca-app-pub-3940256099942544/2934735716' // iOS 테스트 배너 ID
        : 'ca-app-pub-3940256099942544/6300978111', // Android 테스트 배너 ID
      adSize: BannerAdSize.BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: 0,
      isTesting: true,
    };

    try {
      await AdMob.showBanner(options);
    } catch (error) {
      console.error('Failed to show banner ad', error);
    }
  }

  /**
   * 전면 광고 표시
   */
  public async showInterstitial(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    const options: InterstitialAdOptions = {
      adId: Capacitor.getPlatform() === 'ios'
        ? 'ca-app-pub-3940256099942544/4411468910'
        : 'ca-app-pub-3940256099942544/1033173712',
      isTesting: true,
    };

    try {
      await AdMob.prepareInterstitial(options);
      await AdMob.showInterstitial();
    } catch (error) {
      console.error('Failed to show interstitial ad', error);
    }
  }

  /**
   * 보상형 광고 표시
   */
  public async showRewardAd(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    const options: RewardAdOptions = {
      adId: Capacitor.getPlatform() === 'ios'
        ? 'ca-app-pub-3940256099942544/1712485313'
        : 'ca-app-pub-3940256099942544/5224354917',
      isTesting: true,
    };

    try {
      await AdMob.prepareRewardVideoAd(options);
      await AdMob.showRewardVideoAd();
    } catch (error) {
      console.error('Failed to show reward ad', error);
    }
  }

  /**
   * 배너 광고 숨기기
   */
  public async hideBanner(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    
    try {
      await AdMob.hideBanner();
    } catch (error) {
      console.error('Failed to hide banner ad', error);
    }
  }

  /**
   * 배너 광고 제거
   */
  public async removeBanner(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    try {
      await AdMob.removeBanner();
    } catch (error) {
      console.error('Failed to remove banner ad', error);
    }
  }
}

export const admobService = AdMobService.getInstance();
