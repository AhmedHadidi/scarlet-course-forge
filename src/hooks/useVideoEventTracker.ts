import { useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { YouTubePlayerEvent } from "./useYouTubePlayer";

interface VideoEventTrackerOptions {
  userId: string | undefined;
  videoId: string;
  sessionId: string;
  trackingEnabled: boolean;
}

interface BehavioralSummary {
  totalWatchTime: number;
  pauseCount: number;
  rewindCount: number;
  skipCount: number;
  maxPlaybackRate: number;
  completionRate: number;
  dropOffPoint: number | null;
}

export function useVideoEventTracker({
  userId,
  videoId,
  sessionId,
  trackingEnabled,
}: VideoEventTrackerOptions) {
  const eventBufferRef = useRef<any[]>([]);
  const flushTimerRef = useRef<NodeJS.Timeout | null>(null);
  const summaryRef = useRef<BehavioralSummary>({
    totalWatchTime: 0,
    pauseCount: 0,
    rewindCount: 0,
    skipCount: 0,
    maxPlaybackRate: 1,
    completionRate: 0,
    dropOffPoint: null,
  });
  const lastProgressTimeRef = useRef(0);
  const videoIdRef = useRef(videoId);

  // Reset on video change
  useEffect(() => {
    if (videoIdRef.current !== videoId) {
      summaryRef.current = {
        totalWatchTime: 0,
        pauseCount: 0,
        rewindCount: 0,
        skipCount: 0,
        maxPlaybackRate: 1,
        completionRate: 0,
        dropOffPoint: null,
      };
      lastProgressTimeRef.current = 0;
      videoIdRef.current = videoId;
    }
  }, [videoId]);

  const flushEvents = useCallback(async () => {
    if (!userId || !trackingEnabled || eventBufferRef.current.length === 0) return;

    const events = [...eventBufferRef.current];
    eventBufferRef.current = [];

    try {
      const { error } = await supabase.from("video_events").insert(events);
      if (error) {
        console.error("Failed to flush video events:", error);
        // Re-add failed events (but cap buffer size)
        if (eventBufferRef.current.length < 100) {
          eventBufferRef.current.unshift(...events);
        }
      }
    } catch (err) {
      console.error("Error flushing video events:", err);
    }
  }, [userId, trackingEnabled]);

  // Flush on unmount
  useEffect(() => {
    return () => {
      if (flushTimerRef.current) clearInterval(flushTimerRef.current);
      // Attempt a final flush
      if (eventBufferRef.current.length > 0 && userId && trackingEnabled) {
        const events = [...eventBufferRef.current];
        eventBufferRef.current = [];
        supabase.from("video_events").insert(events).then(() => {});
      }
    };
  }, [userId, trackingEnabled]);

  // Periodic flush every 10 seconds
  useEffect(() => {
    if (!trackingEnabled) return;
    flushTimerRef.current = setInterval(flushEvents, 10000);
    return () => {
      if (flushTimerRef.current) clearInterval(flushTimerRef.current);
    };
  }, [flushEvents, trackingEnabled]);

  const trackEvent = useCallback(
    (event: YouTubePlayerEvent) => {
      if (!userId || !trackingEnabled || !videoId) return;

      const summary = summaryRef.current;

      // Update behavioral summary
      switch (event.eventType) {
        case "progress":
          // Calculate watch time increment (5s intervals)
          summary.totalWatchTime += 5;
          summary.completionRate = event.percentageWatched;
          summary.dropOffPoint = event.videoTime;
          lastProgressTimeRef.current = event.videoTime;
          // Don't buffer progress events (too many) - just update summary
          return;
        case "pause":
          summary.pauseCount++;
          break;
        case "seek_backward":
          summary.rewindCount++;
          break;
        case "seek_forward":
          summary.skipCount++;
          break;
        case "playback_rate_change":
          if (event.playbackRate > summary.maxPlaybackRate) {
            summary.maxPlaybackRate = event.playbackRate;
          }
          break;
        case "completed":
          summary.completionRate = 100;
          summary.dropOffPoint = null;
          break;
      }

      // Buffer the event for batch insert
      eventBufferRef.current.push({
        user_id: userId,
        video_id: videoId,
        session_id: sessionId,
        event_type: event.eventType,
        video_time: event.videoTime,
        total_duration: event.totalDuration,
        playback_rate: event.playbackRate,
        percentage_watched: event.percentageWatched,
        metadata: event.metadata || {},
      });

      // Flush immediately for important events
      if (["completed", "error"].includes(event.eventType)) {
        flushEvents();
      }
    },
    [userId, videoId, sessionId, trackingEnabled, flushEvents]
  );

  const getSummary = useCallback(() => ({ ...summaryRef.current }), []);

  return { trackEvent, getSummary, flushEvents };
}
