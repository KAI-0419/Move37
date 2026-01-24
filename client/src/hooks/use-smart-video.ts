
import { useState, useEffect, useRef, useCallback } from 'react';

interface SmartVideoOptions {
    threshold?: number;   // Visibility threshold (0.0 - 1.0)
    idleTimeout?: number; // Time in ms before considering user idle
}

/**
 * useSmartVideo Hook - "The Triple-Check System"
 * 
 * Orchestrates video playback based on three critical conditions to optimize performance:
 * 1. Spatial Visibility: Is the video 90% visible in the viewport?
 * 2. System Focus: Is the browser tab active?
 * 3. User Activity: Has the user interacted recently (within 60s)?
 * 
 * @param config Configuration options
 * @returns [videoRef, shouldPlay, isIdle]
 */
export function useSmartVideo({
    threshold = 0.9,      // Default 90% visibility required 
    idleTimeout = 60000   // Default 60 seconds idle timeout
}: SmartVideoOptions = {}) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isFocused, setIsFocused] = useState(true);
    const [isIdle, setIsIdle] = useState(false);

    // Idle timer ref
    const idleTimerRef = useRef<NodeJS.Timeout | null>(null);

    // 1. Spatial Visibility Check (IntersectionObserver)
    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                setIsVisible(entry.isIntersecting);
            },
            { threshold }
        );

        if (videoRef.current) {
            observer.observe(videoRef.current);
        }

        return () => {
            if (videoRef.current) observer.unobserve(videoRef.current);
            observer.disconnect();
        };
    }, [threshold]);

    // 2. System Focus Check (Visibility API)
    useEffect(() => {
        const handleVisibilityChange = () => {
            setIsFocused(document.visibilityState === 'visible');
        };

        // Initialize state
        setIsFocused(document.visibilityState === 'visible');

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, []);

    // 3. User Activity Check (Idle Detection)
    const resetIdleTimer = useCallback(() => {
        if (isIdle) setIsIdle(false);

        if (idleTimerRef.current) {
            clearTimeout(idleTimerRef.current);
        }

        idleTimerRef.current = setTimeout(() => {
            setIsIdle(true);
        }, idleTimeout);
    }, [idleTimeout, isIdle]);

    useEffect(() => {
        // Events to detect user activity
        const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];

        // Optimize: Use passive listeners and throttling could be added if needed, 
        // but simple reset is usually fine for these events if logic is light.
        const handleInteraction = () => resetIdleTimer();

        events.forEach(event => {
            window.addEventListener(event, handleInteraction, { passive: true });
        });

        // Start timer on mount
        resetIdleTimer();

        return () => {
            events.forEach(event => {
                window.removeEventListener(event, handleInteraction);
            });
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        };
    }, [resetIdleTimer]);

    // Final Decision Logic
    const shouldPlay = isVisible && isFocused && !isIdle;

    // Direct Video Control Side Effect
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        if (shouldPlay) {
            const playPromise = video.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    // Auto-play might be blocked, usually acceptable in previews
                    console.debug("SmartVideo: Auto-play prevented", error);
                });
            }
        } else {
            video.pause();
        }
    }, [shouldPlay]);

    return {
        videoRef,
        shouldPlay,
        isIdle,
        debugStatus: { isVisible, isFocused, isIdle } // Exposed for debugging if needed
    };
}
