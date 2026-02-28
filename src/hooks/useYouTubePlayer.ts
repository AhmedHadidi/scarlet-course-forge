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
  /** Start playback from this position in seconds (for resume) */
  startSeconds?: number;
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
  startSeconds = 0,
}: UseYouTubePlayerOptions) {
  const playerRef = useRef<any>(null);
  const lastTimeRef = useRef(0);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  // Store startSeconds in a ref so initPlayer always has the latest value
  const startSecondsRef = useRef(startSeconds);
  startSecondsRef.current = startSeconds;
  // Track whether we just did an initial seek (to suppress false seek detection)
  const initialSeekDoneRef = useRef(false);

  const emitEvent = useCallback(
    (type: string, metadata?: Record<string, any>) => {
      if (!playerRef.current) return;
      const player = playerRef.current;
      try {
        const ct = player.getCurrentTime?.() || 0;
        const duration = player.getDuration?.() || 0;
        const rate = player.getPlaybackRate?.() || 1;
        const pct = duration > 0 ? (ct / duration) * 100 : 0;

        setCurrentTime(Math.round(ct));
        if (duration > 0) setTotalDuration(Math.round(duration));

        onEventRef.current({
          eventType: type,
          videoTime: Math.round(ct * 100) / 100,
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
        // Skip the very first seek when resuming from a saved position
        if (!initialSeekDoneRef.current && startSecondsRef.current > 0) {
          initialSeekDoneRef.current = true;
          lastTimeRef.current = current;
          return;
        }
        if (diff > 0) {
          emitEvent("seek_forward", { from: lastTimeRef.current, to: current });
        } else {
          emitEvent("seek_backward", { from: lastTimeRef.current, to: current });
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
    initialSeekDoneRef.current = false;

    const initPlayer = async () => {
      await loadYouTubeAPI();
      if (destroyed) return;

      // Destroy previous player
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch { /* ignore */ }
        playerRef.current = null;
      }

      const start = startSecondsRef.current;

      playerRef.current = new window.YT.Player(containerId, {
        videoId,
        playerVars: {
          enablejsapi: 1,
          rel: 0,
          modestbranding: 1,
          // Resume from last saved position (0 = start from beginning)
          start: start > 0 ? Math.floor(start) : undefined,
        },
        events: {
          onReady: () => {
            if (destroyed) return;
            setIsReady(true);
            // Also seek explicitly in case playerVars.start was ignored
            if (start > 0) {
              try { playerRef.current?.seekTo(start, true); } catch { }
            }
            // Snapshot the starting position so first seek from here isn't a false positive
            lastTimeRef.current = start > 0 ? start : 0;
            emitEvent("player_ready");
          },
          onStateChange: (e: any) => {
            if (destroyed) return;

            switch (e.data) {
              case window.YT.PlayerState.PLAYING:
                setIsPlaying(true);
                // Check for seek BEFORE starting the progress interval
                // This catches seeks that happened during pause or buffering
                checkForSeek();
                emitEvent("play");
                if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
                progressIntervalRef.current = setInterval(() => {
                  checkForSeek();
                  emitEvent("progress");
                  if (playerRef.current) {
                    setCurrentTime(Math.round(playerRef.current.getCurrentTime?.() || 0));
                  }
                }, 5000); // every 5 seconds
                break;
              case window.YT.PlayerState.PAUSED:
                setIsPlaying(false);
                // Snapshot current position so seeks while paused are detected
                // when the video resumes (PLAYING state)
                if (playerRef.current) {
                  try {
                    lastTimeRef.current = playerRef.current.getCurrentTime() || 0;
                  } catch { /* ignore */ }
                }
                emitEvent("pause");
                if (progressIntervalRef.current) {
                  clearInterval(progressIntervalRef.current);
                  progressIntervalRef.current = null;
                }
                break;
              case window.YT.PlayerState.ENDED:
                setIsPlaying(false);
                emitEvent("completed");
                if (progressIntervalRef.current) {
                  clearInterval(progressIntervalRef.current);
                  progressIntervalRef.current = null;
                }
                break;
              case window.YT.PlayerState.BUFFERING:
                // Stop the progress interval during buffering to prevent
                // it from updating lastTimeRef to the post-seek position
                // before we can detect the seek
                if (progressIntervalRef.current) {
                  clearInterval(progressIntervalRef.current);
                  progressIntervalRef.current = null;
                }
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
      setIsPlaying(false);
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch { /* ignore */ }
        playerRef.current = null;
      }
      setIsReady(false);
    };
  }, [videoUrl, containerId, enabled, emitEvent, checkForSeek]);

  return { isReady, isPlaying, currentTime, totalDuration, player: playerRef };
}
