import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, AlertTriangle, CheckCircle2, XCircle, Brain, Search, ArrowUpDown } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";

interface SubAdminVideoEngagementProps {
  departmentId: string;
}

interface VideoEngagementRecord {
  userName: string;
  videoTitle: string;
  courseTitle: string;
  watchTimeSeconds: number;
  totalDurationSeconds: number;
  watchPercentage: number;
  tabSwitches: number;
  engagementScore: number;
  aiVerificationPassed: boolean | null;
  aiQuestion: string | null;
  aiUserAnswer: string | null;
  updatedAt: string;
}

interface VideoEngagementSummary {
  totalRecords: number;
  avgEngagementScore: number;
  avgWatchPercentage: number;
  totalTabSwitches: number;
  verifiedCount: number;
  failedCount: number;
  pendingCount: number;
  suspiciousCount: number;
}

export const SubAdminVideoEngagement = ({ departmentId }: SubAdminVideoEngagementProps) => {
  const [records, setRecords] = useState<VideoEngagementRecord[]>([]);
  const [summary, setSummary] = useState<VideoEngagementSummary>({
    totalRecords: 0,
    avgEngagementScore: 0,
    avgWatchPercentage: 0,
    totalTabSwitches: 0,
    verifiedCount: 0,
    failedCount: 0,
    pendingCount: 0,
    suspiciousCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<string>("updatedAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    fetchEngagementData();
  }, [departmentId]);

  const fetchEngagementData = async () => {
    try {
      setLoading(true);

      // Fetch department users first
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("department_id", departmentId);

      if (profilesError) throw profilesError;
      if (!profiles || profiles.length === 0) {
        setLoading(false);
        return;
      }

      const userIds = profiles.map(p => p.id);
      const profilesMap = new Map<string, string>(profiles.map(p => [p.id, p.full_name]));

      // Fetch engagement data for department users only
      const { data: engagementData, error } = await supabase
        .from("video_engagement")
        .select("*")
        .in("user_id", userIds)
        .order("updated_at", { ascending: false })
        .limit(500);

      if (error) throw error;
      if (!engagementData || engagementData.length === 0) {
        setLoading(false);
        return;
      }

      // Get unique video IDs
      const videoIds = [...new Set(engagementData.map(e => e.video_id))];

      const { data: videosData } = videoIds.length > 0
        ? await supabase.from("course_videos").select("id, title, courses(title)").in("id", videoIds)
        : { data: [] as any[] };

      const videosMap = new Map<string, { title: string; courseTitle: string }>(
        (videosData || []).map((v: any) => [
          v.id,
          { title: v.title, courseTitle: v.courses?.title || "Unknown" },
        ])
      );

      const mapped: VideoEngagementRecord[] = engagementData.map(e => {
        const watchPercentage =
          e.total_duration_seconds > 0
            ? Math.round((e.watch_time_seconds / e.total_duration_seconds) * 100)
            : 0;
        const video = videosMap.get(e.video_id);
        return {
          userName: profilesMap.get(e.user_id) || "Unknown",
          videoTitle: video?.title || "Unknown",
          courseTitle: video?.courseTitle || "Unknown",
          watchTimeSeconds: e.watch_time_seconds,
          totalDurationSeconds: e.total_duration_seconds,
          watchPercentage,
          tabSwitches: e.tab_switches,
          engagementScore: Number(e.engagement_score),
          aiVerificationPassed: e.ai_verification_passed,
          aiQuestion: e.ai_question,
          aiUserAnswer: e.ai_user_answer,
          updatedAt: e.updated_at,
        };
      });

      // Summary stats
      const totalRecords = mapped.length;
      const avgEngagementScore =
        totalRecords > 0
          ? Math.round(mapped.reduce((s, r) => s + r.engagementScore, 0) / totalRecords)
          : 0;
      const avgWatchPercentage =
        totalRecords > 0
          ? Math.round(mapped.reduce((s, r) => s + r.watchPercentage, 0) / totalRecords)
          : 0;
      const totalTabSwitches = mapped.reduce((s, r) => s + r.tabSwitches, 0);
      const verifiedCount = mapped.filter(r => r.aiVerificationPassed === true).length;
      const failedCount = mapped.filter(r => r.aiVerificationPassed === false).length;
      const pendingCount = mapped.filter(r => r.aiVerificationPassed === null).length;
      const suspiciousCount = mapped.filter(r => r.tabSwitches >= 5 || r.engagementScore < 50).length;

      setSummary({
        totalRecords,
        avgEngagementScore,
        avgWatchPercentage,
        totalTabSwitches,
        verifiedCount,
        failedCount,
        pendingCount,
        suspiciousCount,
      });
      setRecords(mapped);
    } catch (error) {
      console.error("Error fetching engagement data:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const filtered = records
    .filter(r => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !r.userName.toLowerCase().includes(q) &&
          !r.videoTitle.toLowerCase().includes(q) &&
          !r.courseTitle.toLowerCase().includes(q)
        )
          return false;
      }
      if (statusFilter === "verified") return r.aiVerificationPassed === true;
      if (statusFilter === "failed") return r.aiVerificationPassed === false;
      if (statusFilter === "pending") return r.aiVerificationPassed === null;
      if (statusFilter === "suspicious") return r.tabSwitches >= 5 || r.engagementScore < 50;
      return true;
    })
    .sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortField) {
        case "engagementScore":
          aVal = a.engagementScore;
          bVal = b.engagementScore;
          break;
        case "tabSwitches":
          aVal = a.tabSwitches;
          bVal = b.tabSwitches;
          break;
        case "watchPercentage":
          aVal = a.watchPercentage;
          bVal = b.watchPercentage;
          break;
        default:
          aVal = a.updatedAt;
          bVal = b.updatedAt;
      }
      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading video engagement data...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Eye className="h-5 w-5 text-primary" />
              <span className="text-sm text-muted-foreground">Total Records</span>
            </div>
            <p className="text-2xl font-bold">{summary.totalRecords}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="h-5 w-5 text-primary" />
              <span className="text-sm text-muted-foreground">Avg Engagement</span>
            </div>
            <p className="text-2xl font-bold">{summary.avgEngagementScore}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span className="text-sm text-muted-foreground">Verified</span>
            </div>
            <p className="text-2xl font-bold">{summary.verifiedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <span className="text-sm text-muted-foreground">Suspicious</span>
            </div>
            <p className="text-2xl font-bold">{summary.suspiciousCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by user, video, or course..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Records</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="suspicious">Suspicious</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Engagement Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Video Watch Behavior ({filtered.length} records)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-[600px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Video</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="p-0 h-auto font-medium"
                      onClick={() => handleSort("watchPercentage")}
                    >
                      Watch %
                      <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>Watch Time</TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="p-0 h-auto font-medium"
                      onClick={() => handleSort("tabSwitches")}
                    >
                      Tab Switches
                      <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="p-0 h-auto font-medium"
                      onClick={() => handleSort("engagementScore")}
                    >
                      Engagement
                      <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>Verification</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      No video engagement data found
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((record, index) => {
                    const isSuspicious = record.tabSwitches >= 5 || record.engagementScore < 50;
                    return (
                      <TableRow key={index} className={isSuspicious ? "bg-amber-50/50 dark:bg-amber-950/10" : ""}>
                        <TableCell className="font-medium">{record.userName}</TableCell>
                        <TableCell className="max-w-[150px] truncate" title={record.videoTitle}>
                          {record.videoTitle}
                        </TableCell>
                        <TableCell className="max-w-[120px] truncate" title={record.courseTitle}>
                          {record.courseTitle}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={record.watchPercentage} className="h-2 w-16" />
                            <span className="text-sm">{record.watchPercentage}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDuration(record.watchTimeSeconds)} / {formatDuration(record.totalDurationSeconds)}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`font-medium ${
                              record.tabSwitches >= 5
                                ? "text-red-600"
                                : record.tabSwitches >= 3
                                ? "text-amber-600"
                                : "text-foreground"
                            }`}
                          >
                            {record.tabSwitches}
                            {record.tabSwitches >= 5 && (
                              <AlertTriangle className="inline ml-1 h-3 w-3" />
                            )}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress
                              value={record.engagementScore}
                              className={`h-2 w-16 ${
                                record.engagementScore < 50
                                  ? "[&>div]:bg-red-500"
                                  : record.engagementScore < 70
                                  ? "[&>div]:bg-amber-500"
                                  : ""
                              }`}
                            />
                            <span className="text-sm">{Math.round(record.engagementScore)}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {record.aiVerificationPassed === true ? (
                            <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              Passed
                            </Badge>
                          ) : record.aiVerificationPassed === false ? (
                            <Badge variant="destructive">
                              <XCircle className="mr-1 h-3 w-3" />
                              Failed
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Pending</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(record.updatedAt), "MMM dd, yyyy")}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
