import { supabase } from "@/integrations/supabase/client";

type EnsureCertificateInput = {
  userId: string;
  courseId: string;
};

export type EnsureCertificateResult = {
  certificateId: string | null;
  created: boolean;
  error: string | null;
};

const makeRandomToken = (): string => {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

/**
 * Ensures a single certificate row exists for (userId, courseId).
 * Uses SELECT-then-INSERT to avoid requiring UPDATE privileges (which upsert would need on conflict).
 */
export async function ensureCertificateForUserCourse(
  input: EnsureCertificateInput
): Promise<EnsureCertificateResult> {
  const { userId, courseId } = input;

  const { data: existing, error: existingError } = await supabase
    .from("certificates")
    .select("id")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .maybeSingle();

  if (existingError) {
    return { certificateId: null, created: false, error: existingError.message };
  }

  if (existing?.id) {
    return { certificateId: existing.id, created: false, error: null };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("certificates")
    .insert({
      user_id: userId,
      course_id: courseId,
      certificate_url: `certificate-${makeRandomToken()}`,
    })
    .select("id")
    .single();

  if (insertError) {
    return { certificateId: null, created: false, error: insertError.message };
  }

  return { certificateId: inserted.id, created: true, error: null };
}

export async function backfillCertificatesForUser(userId: string): Promise<{
  checkedCourses: number;
  createdCount: number;
  error: string | null;
}> {
  // Find all passed post-quiz attempts and derive course_ids.
  const { data: attempts, error } = await supabase
    .from("quiz_attempts")
    .select("quiz_id, quizzes(course_id)")
    .eq("user_id", userId)
    .eq("attempt_type", "post")
    .eq("passed", true);

  if (error) {
    return { checkedCourses: 0, createdCount: 0, error: error.message };
  }

  const courseIds = Array.from(
    new Set(
      (attempts ?? [])
        .map((a: any) => a?.quizzes?.course_id as string | undefined)
        .filter(Boolean)
    )
  ) as string[];

  let createdCount = 0;
  for (const courseId of courseIds) {
    const res = await ensureCertificateForUserCourse({ userId, courseId });
    if (res.created) createdCount += 1;
  }

  return { checkedCourses: courseIds.length, createdCount, error: null };
}
