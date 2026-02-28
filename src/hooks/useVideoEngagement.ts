import { useState, useEffect, useCallback, useRef } from "react";

interface EngagementData {
  /** Actual seconds of video playback (incremented only when playing) */
  watchTimeSeconds: number;
  totalDurationSeconds: number;
  tabSwitches: number;
  isActive: boolean;
  watchRatio: number;
}

interface UseVideoEngagementOptions {
  videoId: string;
  videoDuration: number | null;
  onTabSwitch?: () => void;
}

export function useVideoEngagement({
  videoId,
  videoDuration,
  onTabSwitch
}: UseVideoEngagementOptions) {
  const [engagement, setEngagement] = useState<EngagementData>({
    watchTimeSeconds: 0,
    totalDurationSeconds: videoDuration || 0,
    tabSwitches: 0,
    isActive: true,
    watchRatio: 0,
  });

  const lastVideoIdRef = useRef<string>(videoId);
  // Track whether the video is currently playing (set externally via addPlaySeconds)
  const isPlayingRef = useRef(false);
  const playIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Reset when video changes
  useEffect(() => {
    if (lastVideoIdRef.current !== videoId) {
      setEngagement({
        watchTimeSeconds: 0,
        totalDurationSeconds: videoDuration || 0,
        tabSwitches: 0,
        isActive: true,
        watchRatio: 0,
      });
      lastVideoIdRef.current = videoId;
      isPlayingRef.current = false;
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
        playIntervalRef.current = null;
      }
    }
  }, [videoId, videoDuration]);

  // Update duration when it becomes available
  useEffect(() => {
    if (videoDuration && videoDuration > 0) {
      setEngagement(prev => ({
        ...prev,
        totalDurationSeconds: videoDuration,
        watchRatio: videoDuration > 0 ? Math.min(1, prev.watchTimeSeconds / videoDuration) : 0,
      }));
    }
  }, [videoDuration]);

  /**
   * Called by the YouTube player's 5-second progress tick (or other intervals).
   * Adds `seconds` to the watch time — only actual play seconds, not wall clock.
   */
  const addPlaySeconds = useCallback((seconds: number) => {
    setEngagement(prev => {
      const newWatchTime = prev.watchTimeSeconds + seconds;
      const duration = prev.totalDurationSeconds || 1;
      return {
        ...prev,
        watchTimeSeconds: newWatchTime,
        watchRatio: Math.min(1, newWatchTime / duration),
      };
    });
  }, []);

  // Track tab visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === "visible";

      setEngagement(prev => {
        if (!isVisible && prev.isActive) {
          onTabSwitch?.();
          return {
            ...prev,
            isActive: false,
            tabSwitches: prev.tabSwitches + 1,
          };
        } else if (isVisible && !prev.isActive) {
          return {
            ...prev,
            isActive: true,
          };
        }
        return prev;
      });
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [onTabSwitch]);

  // Track window blur/focus
  useEffect(() => {
    const handleBlur = () => {
      setEngagement(prev => {
        if (prev.isActive) {
          onTabSwitch?.();
          return {
            ...prev,
            isActive: false,
            tabSwitches: prev.tabSwitches + 1,
          };
        }
        return prev;
      });
    };

    const handleFocus = () => {
      setEngagement(prev => ({
        ...prev,
        isActive: true,
      }));
    };

    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
    };
  }, [onTabSwitch]);

  const resetEngagement = useCallback(() => {
    isPlayingRef.current = false;
    if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
      playIntervalRef.current = null;
    }
    setEngagement({
      watchTimeSeconds: 0,
      totalDurationSeconds: videoDuration || 0,
      tabSwitches: 0,
      isActive: true,
      watchRatio: 0,
    });
  }, [videoDuration]);

  const setManualDuration = useCallback((duration: number) => {
    setEngagement(prev => ({
      ...prev,
      totalDurationSeconds: duration,
      watchRatio: duration > 0 ? Math.min(1, prev.watchTimeSeconds / duration) : 0,
    }));
  }, []);

  return {
    engagement,
    resetEngagement,
    setManualDuration,
    addPlaySeconds,
  };
}
