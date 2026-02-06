import { useState, useEffect, useCallback, useRef } from "react";

interface EngagementData {
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

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastVideoIdRef = useRef<string>(videoId);

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
    }
  }, [videoId, videoDuration]);

  // Update duration when it becomes available
  useEffect(() => {
    if (videoDuration && videoDuration > 0) {
      setEngagement(prev => ({
        ...prev,
        totalDurationSeconds: videoDuration,
        watchRatio: prev.watchTimeSeconds / videoDuration,
      }));
    }
  }, [videoDuration]);

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

  // Track tab visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === "visible";
      
      setEngagement(prev => {
        if (!isVisible && prev.isActive) {
          // User switched away - increment tab switch counter
          onTabSwitch?.();
          return {
            ...prev,
            isActive: false,
            tabSwitches: prev.tabSwitches + 1,
          };
        } else if (isVisible && !prev.isActive) {
          // User returned
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
      watchRatio: duration > 0 ? prev.watchTimeSeconds / duration : 0,
    }));
  }, []);

  return {
    engagement,
    resetEngagement,
    setManualDuration,
  };
}
