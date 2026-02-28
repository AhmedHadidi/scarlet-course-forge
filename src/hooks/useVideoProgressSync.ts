import { useEffect, useRef, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UseVideoProgressSyncOptions {
    userId: string | undefined;
    videoId: string;
    courseId: string;
    isPlaying: boolean;
    currentTime: number;
    totalDuration: number;
}

interface VideoProgressState {
    lastPosition: number;
    wasCompleted: boolean;
    loaded: boolean;
}

const AUTOSAVE_INTERVAL_MS = 5000;
const LS_KEY = (userId: string, videoId: string) => `vp_${userId}_${videoId}`;

export function useVideoProgressSync({
    userId,
    videoId,
    courseId,
    isPlaying,
    currentTime,
    totalDuration,
}: UseVideoProgressSyncOptions) {
    const [progress, setProgress] = useState<VideoProgressState>({
        lastPosition: 0,
        wasCompleted: false,
        loaded: false,
    });

    const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isSavingRef = useRef(false);

    // ── Keep a ref of currentTime so intervals/callbacks always read the latest ──
    const currentTimeRef = useRef(currentTime);
    currentTimeRef.current = currentTime;

    // ─── Load saved position on mount (localStorage + DB completed check) ────
    useEffect(() => {
        if (!userId || !videoId) return;
        let cancelled = false;

        const load = async () => {
            // Try localStorage first (fastest, most reliable for position)
            let pos = 0;
            try {
                const raw = localStorage.getItem(LS_KEY(userId, videoId));
                if (raw) {
                    const cached = JSON.parse(raw);
                    pos = Number(cached.position ?? 0);
                }
            } catch { /* ignore */ }

            // Also check DB for completed status
            const { data } = await supabase
                .from("video_progress")
                .select("completed")
                .eq("user_id", userId)
                .eq("video_id", videoId)
                .maybeSingle();

            if (cancelled) return;

            const completed = data?.completed ?? false;

            setProgress({
                lastPosition: completed ? 0 : pos,
                wasCompleted: completed,
                loaded: true,
            });
        };

        load();
        return () => { cancelled = true; };
    }, [userId, videoId]);

    // ─── Save position to localStorage (uses ref for latest currentTime) ─────
    const saveProgress = useCallback(
        (positionOverride?: number) => {
            if (!userId || !videoId) return;
            // Use override if provided, otherwise read the ref for the latest time
            const position = positionOverride ?? currentTimeRef.current;

            if (position <= 0) return; // Don't save 0 position

            try {
                localStorage.setItem(
                    LS_KEY(userId, videoId),
                    JSON.stringify({ position: Math.round(position) })
                );
            } catch { /* ignore */ }

            // Also update last_watched_at in DB (uses only existing columns)
            if (!isSavingRef.current) {
                isSavingRef.current = true;
                supabase
                    .from("video_progress")
                    .upsert(
                        {
                            user_id: userId,
                            video_id: videoId,
                            last_watched_at: new Date().toISOString(),
                        },
                        { onConflict: "user_id,video_id" }
                    )
                    .then(() => { isSavingRef.current = false; })
                    .then(undefined, () => { isSavingRef.current = false; });
            }
        },
        [userId, videoId]  // No longer depends on currentTime — reads from ref
    );

    // ─── Auto-save every 5s while playing ────────────────────────────────────
    useEffect(() => {
        if (!progress.loaded) return;

        if (isPlaying) {
            saveTimerRef.current = setInterval(() => {
                saveProgress();  // Now always reads currentTimeRef.current (latest)
            }, AUTOSAVE_INTERVAL_MS);
        } else {
            // Save once when pausing
            saveProgress();
            if (saveTimerRef.current) {
                clearInterval(saveTimerRef.current);
                saveTimerRef.current = null;
            }
        }

        return () => {
            if (saveTimerRef.current) {
                clearInterval(saveTimerRef.current);
                saveTimerRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isPlaying, progress.loaded, saveProgress]);

    // ─── Save on page unload ─────────────────────────────────────────────────
    useEffect(() => {
        if (!userId || !videoId) return;

        const handleUnload = () => {
            // Read from ref for latest value
            const pos = currentTimeRef.current;
            if (pos <= 0) return;
            try {
                localStorage.setItem(
                    LS_KEY(userId, videoId),
                    JSON.stringify({ position: Math.round(pos) })
                );
            } catch { /* ignore */ }
        };

        window.addEventListener("beforeunload", handleUnload);
        return () => window.removeEventListener("beforeunload", handleUnload);
    }, [userId, videoId]);  // Only depends on userId/videoId — reads time from ref

    const reset = useCallback(() => {
        setProgress({ lastPosition: 0, wasCompleted: false, loaded: false });
    }, []);

    return {
        lastPosition: progress.lastPosition,
        wasCompleted: progress.wasCompleted,
        loaded: progress.loaded,
        saveProgress,
        reset,
    };
}
