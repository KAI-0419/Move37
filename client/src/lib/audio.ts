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
  // 추가 피드백 사운드 (기존 사운드 재활용, 볼륨 조절로 차별화)
  ERROR: { id: 'error', path: 'sounds/lose.ogg' },           // 에러 피드백
  TIME_WARNING: { id: 'time_warning', path: 'sounds/turn_change.ogg' }, // 시간 경고
  SELECT: { id: 'select', path: 'sounds/button_click.ogg' }, // 선택 피드백
} as const;

// 진동 패턴 타입
export type HapticPattern = 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'warning';

// LocalStorage keys for audio settings
const AUDIO_ENABLED_KEY = 'move37_audio_enabled';
const HAPTICS_ENABLED_KEY = 'move37_haptics_enabled';

/**
 * Load audio enabled setting from localStorage
 * Returns true by default if no value is stored
 */
function loadAudioEnabledSetting(): boolean {
  try {
    const stored = localStorage.getItem(AUDIO_ENABLED_KEY);
    if (stored === null) return true; // Default to enabled
    return stored === 'true';
  } catch (error) {
    console.warn('Failed to load audio setting from localStorage:', error);
    return true;
  }
}

/**
 * Load haptics enabled setting from localStorage
 * Returns true by default if no value is stored
 */
function loadHapticsEnabledSetting(): boolean {
  try {
    const stored = localStorage.getItem(HAPTICS_ENABLED_KEY);
    if (stored === null) return true; // Default to enabled
    return stored === 'true';
  } catch (error) {
    console.warn('Failed to load haptics setting from localStorage:', error);
    return true;
  }
}

// 오디오 설정 - localStorage에서 초기값 로드
let audioEnabled = loadAudioEnabledSetting();
let hapticsEnabled = loadHapticsEnabledSetting();
let audioInitialized = false;

// 웹 브라우저용 오디오 컨텍스트와 사운드 캐시
let audioContext: AudioContext | null = null;
const webAudioCache = new Map<string, AudioBuffer>();

export class AudioManager {
  private static instance: AudioManager;
  private loadedSounds: Set<string> = new Set();

  // Platform capabilities
  private capabilities = {
    webAudioSupported: false,
    vibrationSupported: false,
    nativeAudioSupported: false,
    nativeHapticsSupported: false
  };

  private constructor() { }

  static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  // Detect platform capabilities
  async detectCapabilities() {
    this.capabilities.webAudioSupported =
      !!(window.AudioContext || (window as any).webkitAudioContext);

    this.capabilities.vibrationSupported =
      'vibrate' in navigator &&
      (window.location.protocol === 'https:' || window.location.hostname === 'localhost');

    this.capabilities.nativeAudioSupported = isNative;
    this.capabilities.nativeHapticsSupported = isNative;

    // console.log('[Audio] Platform capabilities:', this.capabilities);
    return { ...this.capabilities };
  }

  getCapabilities() {
    return { ...this.capabilities };
  }

  // 오디오 초기화
  async initialize(): Promise<void> {
    if (audioInitialized) return;

    // Detect capabilities first
    await this.detectCapabilities();

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
          assetPath: sound.id + '.ogg', // Use filename only for res/raw/
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
        // console.log(`[Audio] AudioContext created, state: ${audioContext.state}`);
      }

      // Handle autoplay policy (suspended state)
      if (audioContext.state === 'suspended') {
        // console.log('[Audio] Resuming suspended AudioContext...');
        await audioContext.resume();
        // console.log(`[Audio] AudioContext resumed, state: ${audioContext.state}`);
      }
    } catch (error) {
      console.error('[Audio] initializeWebAudio failed:', error);
      throw error;
    }
  }



  // 사운드 재생
  async playSound(soundId: string, volume: number = 1.0): Promise<void> {
    if (!audioEnabled) return;

    try {
      if (isNative) {
        // Native: Check if preloaded
        if (!this.loadedSounds.has(soundId)) {
          console.warn(`[Audio] Sound ${soundId} not preloaded for native platform`);
          return;
        }
        // 네이티브 앱에서는 Capacitor Native Audio 사용
        await NativeAudio.play({
          assetId: soundId,
          time: 0
        });
      } else {
        // Web: Allow lazy loading
        await this.playWebSound(soundId, volume);
      }
    } catch (error) {
      console.warn(`[Audio] Failed to play sound ${soundId}:`, error);
    }
  }

  // 웹 브라우저에서 사운드 재생
  private async playWebSound(soundId: string, volume: number = 1.0): Promise<void> {
    try {
      // Stage 1: Initialize AudioContext (requires user gesture)
      if (!audioContext) {
        // console.log('[Audio] Initializing Web Audio on first play');
        await this.initializeWebAudio();
      }

      if (!audioContext) {
        console.warn('[Audio] AudioContext initialization failed');
        return;
      }

      // Stage 2: Load sound if needed (lazy loading)
      if (!webAudioCache.has(soundId)) {
        // console.log(`[Audio] Lazy loading sound: ${soundId}`);
        await this.loadWebSound(soundId);
      }

      if (!webAudioCache.has(soundId)) {
        console.warn(`[Audio] Failed to load sound: ${soundId}`);
        return;
      }

      // Stage 3: Play sound
      const buffer = webAudioCache.get(soundId)!;
      const source = audioContext.createBufferSource();
      const gainNode = audioContext.createGain();

      source.buffer = buffer;
      gainNode.gain.value = volume;

      source.connect(gainNode);
      gainNode.connect(audioContext.destination);

      source.start(0);
      // console.log(`[Audio] Played: ${soundId}`);
    } catch (error) {
      console.warn(`[Audio] playWebSound failed for ${soundId}:`, error);
    }
  }

  // 웹 사운드 개별 로드 (lazy loading)
  private async loadWebSound(soundId: string): Promise<void> {
    if (!audioContext) {
      console.warn('[Audio] Cannot load sound - no AudioContext');
      return;
    }

    const sound = Object.values(GAME_SOUNDS).find(s => s.id === soundId);
    if (!sound) {
      console.warn(`[Audio] Unknown sound ID: ${soundId}`);
      return;
    }

    try {
      // console.log(`[Audio] Fetching: ${sound.path}`);
      const response = await fetch(sound.path);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      // console.log(`[Audio] Decoding ${soundId} (${arrayBuffer.byteLength} bytes)`);

      if (!audioContext) return;

      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      webAudioCache.set(soundId, audioBuffer);
      this.loadedSounds.add(soundId);

      // console.log(`[Audio] Loaded ${soundId} (${audioBuffer.duration.toFixed(2)}s)`);
    } catch (error) {
      console.error(`[Audio] Failed to load ${soundId} from ${sound.path}:`, error);
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
        await Haptics.notification({ type: 'Success' as any });
        break;
      case 'error':
        await Haptics.notification({ type: 'Error' as any });
        break;
      case 'warning':
        await Haptics.notification({ type: 'Warning' as any });
        break;
    }
  }

  // 웹 브라우저 진동
  private vibrateWeb(pattern: HapticPattern): void {
    // Check if Vibration API is supported
    if (!('vibrate' in navigator)) {
      console.warn('[Haptics] Vibration API not supported (iOS Safari does not support it)');
      return;
    }

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

    try {
      const success = navigator.vibrate(duration);
      if (!success) {
        console.warn(`[Haptics] Vibration request failed for pattern: ${pattern}`);
      } else {
        // console.log(`[Haptics] Vibrated: ${pattern} (${duration}ms)`);
      }
    } catch (error) {
      console.warn(`[Haptics] Vibration error:`, error);
    }
  }

  // 설정 토글
  setAudioEnabled(enabled: boolean): void {
    audioEnabled = enabled;
    try {
      localStorage.setItem(AUDIO_ENABLED_KEY, String(enabled));
    } catch (error) {
      console.warn('Failed to save audio setting to localStorage:', error);
    }
  }

  setHapticsEnabled(enabled: boolean): void {
    hapticsEnabled = enabled;
    try {
      localStorage.setItem(HAPTICS_ENABLED_KEY, String(enabled));
    } catch (error) {
      console.warn('Failed to save haptics setting to localStorage:', error);
    }
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
// 추가 사운드 함수들
export const playErrorSound = () => audioManager.playSound(GAME_SOUNDS.ERROR.id, 0.6); // 낮은 볼륨으로 차별화
export const playTimeWarningSound = () => audioManager.playSound(GAME_SOUNDS.TIME_WARNING.id, 0.8);
export const playSelectSound = () => audioManager.playSound(GAME_SOUNDS.SELECT.id, 0.5); // 부드러운 선택음

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

// 추가 통합 효과 함수들
export const playErrorEffect = () => {
  playErrorSound();
  vibrateError();
};

export const playTimeWarningEffect = () => {
  playTimeWarningSound();
  vibrateWarning();
};

export const playSelectEffect = () => {
  playSelectSound();
  vibrateLight();
};