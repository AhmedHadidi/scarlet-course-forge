import { useEffect, useRef, useCallback, useState } from "react";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

export interface YouTubePlayerEvent {
  eventType: string;
  videoTime: number;
  totalDuration: number;
  playbackRate: number;
  percentageWatched: number;
  metadata?: Record<string, any>;
}

interface UseYouTubePlayerOptions {
  containerId: string;
  videoUrl: string;
  onEvent: (event: YouTubePlayerEvent) => void;
  enabled?: boolean;
}

function extractYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/
  );
  return match?.[1] || null;
}

let apiLoaded = false;
let apiLoading = false;
const apiReadyCallbacks: (() => void)[] = [];

function loadYouTubeAPI(): Promise<void> {
  return new Promise((resolve) => {
    if (apiLoaded && window.YT?.Player) {
      resolve();
      return;
    }
    apiReadyCallbacks.push(resolve);
    if (apiLoading) return;
    apiLoading = true;

    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);

    window.onYouTubeIframeAPIReady = () => {
      apiLoaded = true;
      apiReadyCallbacks.forEach((cb) => cb());
      apiReadyCallbacks.length = 0;
    };
  });
}

export function useYouTubePlayer({
  containerId,
  videoUrl,
  onEvent,
  enabled = true,
}: UseYouTubePlayerOptions) {
  const playerRef = useRef<any>(null);
  const lastTimeRef = useRef(0);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isReady, setIsReady] = useState(false);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const emitEvent = useCallback(
    (type: string, metadata?: Record<string, any>) => {
      if (!playerRef.current) return;
      const player = playerRef.current;
      try {
        const currentTime = player.getCurrentTime?.() || 0;
        const duration = player.getDuration?.() || 0;
        const rate = player.getPlaybackRate?.() || 1;
        const pct = duration > 0 ? (currentTime / duration) * 100 : 0;

        onEventRef.current({
          eventType: type,
          videoTime: Math.round(currentTime * 100) / 100,
          totalDuration: Math.round(duration * 100) / 100,
          playbackRate: rate,
          percentageWatched: Math.round(pct * 100) / 100,
          metadata,
        });
      } catch {
        // player may not be ready
      }
    },
    []
  );

  // Detect seeks by comparing expected vs actual time
  const checkForSeek = useCallback(() => {
    if (!playerRef.current) return;
    try {
      const current = playerRef.current.getCurrentTime() || 0;
      const diff = current - lastTimeRef.current;
      if (Math.abs(diff) > 2) {
        if (diff > 0) {
          emitEvent("seek_forward", {
            from: lastTimeRef.current,
            to: current,
          });
        } else {
          emitEvent("seek_backward", {
            from: lastTimeRef.current,
            to: current,
          });
        }
      }
      lastTimeRef.current = current;
    } catch {
      // ignore
    }
  }, [emitEvent]);

  useEffect(() => {
    if (!enabled) return;
    const videoId = extractYouTubeId(videoUrl);
    if (!videoId) return;

    let destroyed = false;

    const initPlayer = async () => {
      await loadYouTubeAPI();
      if (destroyed) return;

      // Destroy previous player
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          // ignore
        }
        playerRef.current = null;
      }

      playerRef.current = new window.YT.Player(containerId, {
        videoId,
        playerVars: {
          enablejsapi: 1,
          rel: 0,
          modestbranding: 1,
        },
        events: {
          onReady: () => {
            if (destroyed) return;
            setIsReady(true);
            emitEvent("player_ready");
          },
          onStateChange: (e: any) => {
            if (destroyed) return;
            checkForSeek();

            switch (e.data) {
              case window.YT.PlayerState.PLAYING:
                emitEvent("play");
                // Start progress tracking
                if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
                progressIntervalRef.current = setInterval(() => {
                  checkForSeek();
                  emitEvent("progress");
                  if (playerRef.current) {
                    lastTimeRef.current = playerRef.current.getCurrentTime?.() || 0;
                  }
                }, 5000); // every 5 seconds
                break;
              case window.YT.PlayerState.PAUSED:
                emitEvent("pause");
                if (progressIntervalRef.current) {
                  clearInterval(progressIntervalRef.current);
                  progressIntervalRef.current = null;
                }
                break;
              case window.YT.PlayerState.ENDED:
                emitEvent("completed");
                if (progressIntervalRef.current) {
                  clearInterval(progressIntervalRef.current);
                  progressIntervalRef.current = null;
                }
                break;
              case window.YT.PlayerState.BUFFERING:
                emitEvent("buffering");
                break;
            }
          },
          onPlaybackRateChange: (e: any) => {
            if (destroyed) return;
            emitEvent("playback_rate_change", { newRate: e.data });
          },
          onError: (e: any) => {
            if (destroyed) return;
            emitEvent("error", { errorCode: e.data });
          },
        },
      });
    };

    initPlayer();

    return () => {
      destroyed = true;
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          // ignore
        }
        playerRef.current = null;
      }
      setIsReady(false);
    };
  }, [videoUrl, containerId, enabled, emitEvent, checkForSeek]);

  return { isReady, player: playerRef };
}
