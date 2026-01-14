import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { NativeAudio } from '@capacitor-community/native-audio';
import { Capacitor } from '@capacitor/core';

// Capacitor가 설치되어 있지 않은 경우를 위한 안전한 import
let capacitorInstance: typeof Capacitor;
try {
  capacitorInstance = Capacitor;
} catch {
  // 웹 환경에서는 mock 객체 사용
  capacitorInstance = {
    isNativePlatform: () => false,
  } as any;
}

// 플랫폼 감지
const isNative = capacitorInstance.isNativePlatform();

// 오디오 파일 타입 정의
export interface AudioAsset {
  id: string;
  path: string;
  volume?: number;
}

// 게임에서 사용할 사운드 효과들
export const GAME_SOUNDS = {
  MOVE: { id: 'move', path: 'sounds/move.ogg' },
  CAPTURE: { id: 'capture', path: 'sounds/capture.ogg' },
  WIN: { id: 'win', path: 'sounds/win.ogg' },
  LOSE: { id: 'lose', path: 'sounds/lose.ogg' },
  DRAW: { id: 'draw', path: 'sounds/draw.ogg' },
  BUTTON_CLICK: { id: 'button_click', path: 'sounds/button_click.ogg' },
  GAME_START: { id: 'game_start', path: 'sounds/game_start.ogg' },
  TURN_CHANGE: { id: 'turn_change', path: 'sounds/turn_change.ogg' },
} as const;

// 진동 패턴 타입
export type HapticPattern = 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'warning';

// 오디오 설정
let audioEnabled = true;
let hapticsEnabled = true;
let audioInitialized = false;

// 웹 브라우저용 오디오 컨텍스트와 사운드 캐시
let audioContext: AudioContext | null = null;
const webAudioCache = new Map<string, AudioBuffer>();

export class AudioManager {
  private static instance: AudioManager;
  private loadedSounds: Set<string> = new Set();

  private constructor() {}

  static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  // 오디오 초기화
  async initialize(): Promise<void> {
    if (audioInitialized) return;

    try {
      // 플랫폼에 따라 다른 방식으로 초기화
      if (isNative) {
        // 네이티브 앱에서는 Capacitor Native Audio 사용
        await this.preloadNativeSounds();
        audioInitialized = true;
      } else {
        // 웹 브라우저에서는 나중에 lazy하게 초기화
        audioInitialized = true;
      }
    } catch (error) {
      console.warn('Audio initialization failed:', error);
    }
  }

  // 네이티브 사운드 미리 로드
  private async preloadNativeSounds(): Promise<void> {
    const soundPromises = Object.values(GAME_SOUNDS).map(async (sound) => {
      try {
        await NativeAudio.preload({
          assetId: sound.id,
          assetPath: sound.path,
          audioChannelNum: 1,
          isUrl: false
        });
        this.loadedSounds.add(sound.id);
      } catch (error) {
        console.warn(`Failed to preload native sound ${sound.id}:`, error);
      }
    });

    await Promise.all(soundPromises);
  }

  // 웹 오디오 컨텍스트 초기화
  private async initializeWebAudio(): Promise<void> {
    try {
      // 사용자 인터랙션 후에만 AudioContext 생성 가능
      if (!audioContext) {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      // AudioContext가 suspended 상태일 수 있으므로 resume
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
    } catch (error) {
      console.warn('Web Audio initialization failed:', error);
    }
  }

  // 웹 사운드 미리 로드
  private async preloadWebSounds(): Promise<void> {
    if (!audioContext) return;

    const soundPromises = Object.values(GAME_SOUNDS).map(async (sound) => {
      try {
        const response = await fetch(sound.path);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        webAudioCache.set(sound.id, audioBuffer);
        this.loadedSounds.add(sound.id);
      } catch (error) {
        console.warn(`Failed to preload web sound ${sound.id}:`, error);
      }
    });

    await Promise.all(soundPromises);
  }

  // 사운드 재생
  async playSound(soundId: string, volume: number = 1.0): Promise<void> {
    if (!audioEnabled || !this.loadedSounds.has(soundId)) return;

    try {
      if (isNative) {
        // 네이티브 앱에서는 Capacitor Native Audio 사용
        await NativeAudio.play({
          assetId: soundId,
          time: 0,
          volume
        });
      } else {
        // 웹 브라우저에서는 Web Audio API 사용
        await this.playWebSound(soundId, volume);
      }
    } catch (error) {
      console.warn(`Failed to play sound ${soundId}:`, error);
    }
  }

  // 웹 브라우저에서 사운드 재생
  private async playWebSound(soundId: string, volume: number = 1.0): Promise<void> {
    try {
      // 필요한 경우 웹 오디오 초기화 (lazy initialization)
      if (!audioContext) {
        await this.initializeWebAudio();
      }

      // 사운드가 로드되지 않은 경우 로드 시도
      if (!webAudioCache.has(soundId)) {
        await this.loadWebSound(soundId);
      }

      if (!audioContext || !webAudioCache.has(soundId)) return;

      const buffer = webAudioCache.get(soundId)!;
      const source = audioContext.createBufferSource();
      const gainNode = audioContext.createGain();

      source.buffer = buffer;
      gainNode.gain.value = volume;

      source.connect(gainNode);
      gainNode.connect(audioContext.destination);

      source.start(0);
    } catch (error) {
      console.warn(`Failed to play web sound ${soundId}:`, error);
    }
  }

  // 웹 사운드 개별 로드 (lazy loading)
  private async loadWebSound(soundId: string): Promise<void> {
    if (!audioContext) return;

    const sound = Object.values(GAME_SOUNDS).find(s => s.id === soundId);
    if (!sound) return;

    try {
      const response = await fetch(sound.path);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      webAudioCache.set(soundId, audioBuffer);
      this.loadedSounds.add(soundId);
    } catch (error) {
      console.warn(`Failed to load web sound ${soundId}:`, error);
    }
  }

  // 진동 실행
  async vibrate(pattern: HapticPattern = 'light'): Promise<void> {
    if (!hapticsEnabled) return;

    try {
      if (isNative) {
        // 네이티브 앱에서는 Capacitor Haptics 사용
        await this.vibrateNative(pattern);
      } else {
        // 웹 브라우저에서는 Vibration API 사용
        this.vibrateWeb(pattern);
      }
    } catch (error) {
      console.warn(`Haptics failed for pattern ${pattern}:`, error);
    }
  }

  // 네이티브 진동
  private async vibrateNative(pattern: HapticPattern): Promise<void> {
    switch (pattern) {
      case 'light':
        await Haptics.impact({ style: ImpactStyle.Light });
        break;
      case 'medium':
        await Haptics.impact({ style: ImpactStyle.Medium });
        break;
      case 'heavy':
        await Haptics.impact({ style: ImpactStyle.Heavy });
        break;
      case 'success':
        await Haptics.notification({ type: 'SUCCESS' });
        break;
      case 'error':
        await Haptics.notification({ type: 'ERROR' });
        break;
      case 'warning':
        await Haptics.notification({ type: 'WARNING' });
        break;
    }
  }

  // 웹 브라우저 진동
  private vibrateWeb(pattern: HapticPattern): void {
    if (!('vibrate' in navigator)) return;

    // 진동 패턴을 밀리초로 변환
    let duration: number;
    switch (pattern) {
      case 'light':
        duration = 50;
        break;
      case 'medium':
        duration = 100;
        break;
      case 'heavy':
        duration = 200;
        break;
      case 'success':
        duration = 300;
        break;
      case 'error':
        duration = 500;
        break;
      case 'warning':
        duration = 200;
        break;
    }

    navigator.vibrate(duration);
  }

  // 설정 토글
  setAudioEnabled(enabled: boolean): void {
    audioEnabled = enabled;
  }

  setHapticsEnabled(enabled: boolean): void {
    hapticsEnabled = enabled;
  }

  // 설정 상태 확인
  isAudioEnabled(): boolean {
    return audioEnabled;
  }

  isHapticsEnabled(): boolean {
    return hapticsEnabled;
  }

  // 리소스 정리
  async cleanup(): Promise<void> {
    try {
      if (isNative) {
        // 네이티브 앱 리소스 정리
        for (const soundId of this.loadedSounds) {
          await NativeAudio.unload({ assetId: soundId });
        }
      } else {
        // 웹 브라우저 리소스 정리
        webAudioCache.clear();
        if (audioContext && audioContext.state !== 'closed') {
          await audioContext.close();
          audioContext = null;
        }
      }

      this.loadedSounds.clear();
      audioInitialized = false;
    } catch (error) {
      console.warn('Audio cleanup failed:', error);
    }
  }
}

// 싱글톤 인스턴스
export const audioManager = AudioManager.getInstance();

// 편의 함수들
export const playMoveSound = () => audioManager.playSound(GAME_SOUNDS.MOVE.id);
export const playCaptureSound = () => audioManager.playSound(GAME_SOUNDS.CAPTURE.id);
export const playWinSound = () => audioManager.playSound(GAME_SOUNDS.WIN.id);
export const playLoseSound = () => audioManager.playSound(GAME_SOUNDS.LOSE.id);
export const playDrawSound = () => audioManager.playSound(GAME_SOUNDS.DRAW.id);
export const playButtonClickSound = () => audioManager.playSound(GAME_SOUNDS.BUTTON_CLICK.id);
export const playGameStartSound = () => audioManager.playSound(GAME_SOUNDS.GAME_START.id);
export const playTurnChangeSound = () => audioManager.playSound(GAME_SOUNDS.TURN_CHANGE.id);

export const vibrateLight = () => audioManager.vibrate('light');
export const vibrateMedium = () => audioManager.vibrate('medium');
export const vibrateHeavy = () => audioManager.vibrate('heavy');
export const vibrateSuccess = () => audioManager.vibrate('success');
export const vibrateError = () => audioManager.vibrate('error');
export const vibrateWarning = () => audioManager.vibrate('warning');

// 게임 이벤트에 따른 통합 효과 함수들
export const playMoveEffect = () => {
  playMoveSound();
  vibrateLight();
};

export const playCaptureEffect = () => {
  playCaptureSound();
  vibrateMedium();
};

export const playWinEffect = () => {
  playWinSound();
  vibrateSuccess();
};

export const playLoseEffect = () => {
  playLoseSound();
  vibrateError();
};

export const playDrawEffect = () => {
  playDrawSound();
  vibrateWarning();
};

export const playButtonEffect = () => {
  playButtonClickSound();
  vibrateLight();
};

export const playGameStartEffect = () => {
  playGameStartSound();
  vibrateMedium();
};

export const playTurnChangeEffect = () => {
  playTurnChangeSound();
  vibrateLight();
};