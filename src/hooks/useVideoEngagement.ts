import { useState, useEffect, useCallback, useRef } from "react";

interface EngagementData {
<<<<<<< HEAD
  /** Actual seconds of video playback (incremented only when playing) */
=======
>>>>>>> 5b56e227004fb842bfd26ac33621142a3f1e8a88
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

<<<<<<< HEAD
export function useVideoEngagement({
  videoId,
  videoDuration,
  onTabSwitch
=======
export function useVideoEngagement({ 
  videoId, 
  videoDuration, 
  onTabSwitch 
>>>>>>> 5b56e227004fb842bfd26ac33621142a3f1e8a88
}: UseVideoEngagementOptions) {
  const [engagement, setEngagement] = useState<EngagementData>({
    watchTimeSeconds: 0,
    totalDurationSeconds: videoDuration || 0,
    tabSwitches: 0,
    isActive: true,
    watchRatio: 0,
  });

<<<<<<< HEAD
  const lastVideoIdRef = useRef<string>(videoId);
  // Track whether the video is currently playing (set externally via addPlaySeconds)
  const isPlayingRef = useRef(false);
  const playIntervalRef = useRef<NodeJS.Timeout | null>(null);
=======
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastVideoIdRef = useRef<string>(videoId);
>>>>>>> 5b56e227004fb842bfd26ac33621142a3f1e8a88

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
<<<<<<< HEAD
      isPlayingRef.current = false;
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
        playIntervalRef.current = null;
      }
=======
>>>>>>> 5b56e227004fb842bfd26ac33621142a3f1e8a88
    }
  }, [videoId, videoDuration]);

  // Update duration when it becomes available
  useEffect(() => {
    if (videoDuration && videoDuration > 0) {
      setEngagement(prev => ({
        ...prev,
        totalDurationSeconds: videoDuration,
<<<<<<< HEAD
        watchRatio: videoDuration > 0 ? Math.min(1, prev.watchTimeSeconds / videoDuration) : 0,
=======
        watchRatio: prev.watchTimeSeconds / videoDuration,
>>>>>>> 5b56e227004fb842bfd26ac33621142a3f1e8a88
      }));
    }
  }, [videoDuration]);

<<<<<<< HEAD
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
=======
  // Track watch time when tab is active
  useEffect(() => {
    if (engagement.isActive) {
      intervalRef.current = setInterval(() => {
        setEngagement(prev => {
          const newWatchTime = prev.watchTimeSeconds + 1;
          const duration = prev.totalDurationSeconds || 1;
          return {
            ...prev,
            watchTimeSeconds: newWatchTime,
            watchRatio: Math.min(1, newWatchTime / duration),
          };
        });
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [engagement.isActive]);
>>>>>>> 5b56e227004fb842bfd26ac33621142a3f1e8a88

  // Track tab visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === "visible";
<<<<<<< HEAD

      setEngagement(prev => {
        if (!isVisible && prev.isActive) {
=======
      
      setEngagement(prev => {
        if (!isVisible && prev.isActive) {
          // User switched away - increment tab switch counter
>>>>>>> 5b56e227004fb842bfd26ac33621142a3f1e8a88
          onTabSwitch?.();
          return {
            ...prev,
            isActive: false,
            tabSwitches: prev.tabSwitches + 1,
          };
        } else if (isVisible && !prev.isActive) {
<<<<<<< HEAD
=======
          // User returned
>>>>>>> 5b56e227004fb842bfd26ac33621142a3f1e8a88
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
<<<<<<< HEAD
    isPlayingRef.current = false;
    if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
      playIntervalRef.current = null;
    }
=======
>>>>>>> 5b56e227004fb842bfd26ac33621142a3f1e8a88
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
<<<<<<< HEAD
      watchRatio: duration > 0 ? Math.min(1, prev.watchTimeSeconds / duration) : 0,
=======
      watchRatio: duration > 0 ? prev.watchTimeSeconds / duration : 0,
>>>>>>> 5b56e227004fb842bfd26ac33621142a3f1e8a88
    }));
  }, []);

  return {
    engagement,
    resetEngagement,
    setManualDuration,
<<<<<<< HEAD
    addPlaySeconds,
=======
>>>>>>> 5b56e227004fb842bfd26ac33621142a3f1e8a88
  };
}
