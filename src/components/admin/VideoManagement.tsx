import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Upload, Link as LinkIcon, List, Loader2, X, Eye, Save, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface VideoManagementProps {
  courseId: string;
  isOpen: boolean;
  onClose: () => void;
  onVideosAdded: () => void;
}

interface VideoData {
  title: string;
  video_url: string;
  description?: string;
  duration_seconds?: number;
  order_index: number;
}

interface ExistingVideo {
  id: string;
  title: string;
  video_url: string;
  description?: string;
  duration_seconds?: number;
  order_index: number;
  video_source: string;
}

export const VideoManagement = ({ courseId, isOpen, onClose, onVideosAdded }: VideoManagementProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  
  // Existing videos
  const [existingVideos, setExistingVideos] = useState<ExistingVideo[]>([]);
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  
  // YouTube Playlist
  const [playlistUrl, setPlaylistUrl] = useState("");
  
  // Manual URLs
  const [manualUrls, setManualUrls] = useState("");
  
  // File Upload
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

  useEffect(() => {
    if (isOpen) {
      fetchExistingVideos();
    }
  }, [isOpen, courseId]);

  const fetchExistingVideos = async () => {
    try {
      const { data, error } = await supabase
        .from("course_videos")
        .select("*")
        .eq("course_id", courseId)
        .order("order_index", { ascending: true });

      if (error) throw error;
      setExistingVideos(data || []);
    } catch (error) {
      console.error("Error fetching videos:", error);
      toast({ title: "Error", description: "Failed to load videos", variant: "destructive" });
    }
  };

  const handleEditVideo = (video: ExistingVideo) => {
    setEditingVideoId(video.id);
    setEditingTitle(video.title);
  };

  const handleSaveVideo = async (videoId: string) => {
    if (!editingTitle.trim()) {
      toast({ title: "Error", description: "Video title cannot be empty", variant: "destructive" });
      return;
    }

    try {
      const { error } = await supabase
        .from("course_videos")
        .update({ title: editingTitle })
        .eq("id", videoId);

      if (error) throw error;

      toast({ title: "Success", description: "Video title updated" });
      setEditingVideoId(null);
      setEditingTitle("");
      fetchExistingVideos();
    } catch (error) {
      console.error("Error updating video:", error);
      toast({ title: "Error", description: "Failed to update video", variant: "destructive" });
    }
  };

  const handleDeleteVideo = async (videoId: string) => {
    if (!confirm("Are you sure you want to delete this video?")) return;

    try {
      const { error } = await supabase
        .from("course_videos")
        .delete()
        .eq("id", videoId);

      if (error) throw error;

      // Update course video count
      const { data: remainingVideos } = await supabase
        .from("course_videos")
        .select("id")
        .eq("course_id", courseId);

      await supabase
        .from("courses")
        .update({ video_count: remainingVideos?.length || 0 })
        .eq("id", courseId);

      toast({ title: "Success", description: "Video deleted successfully" });
      fetchExistingVideos();
      onVideosAdded();
    } catch (error) {
      console.error("Error deleting video:", error);
      toast({ title: "Error", description: "Failed to delete video", variant: "destructive" });
    }
  };

  const extractPlaylistId = (url: string): string | null => {
    const patterns = [
      /[?&]list=([^&]+)/,
      /youtube\.com\/playlist\?list=([^&]+)/,
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  const extractVideoId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/,
      /youtube\.com\/embed\/([^&\s]+)/,
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  const handlePlaylistImport = async () => {
    if (!playlistUrl.trim()) {
      toast({ title: "Error", description: "Please enter a playlist URL", variant: "destructive" });
      return;
    }

    const playlistId = extractPlaylistId(playlistUrl);
    if (!playlistId) {
      toast({ title: "Error", description: "Invalid YouTube playlist URL", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      // Use YouTube oEmbed API (no API key required) or store playlist URL
      // For now, we'll let admin add the playlist info and videos will be entered manually
      toast({
        title: "Note",
        description: "Please enter individual video URLs from the playlist in the 'Manual URLs' tab",
      });
      setPlaylistUrl("");
    } catch (error) {
      console.error("Error importing playlist:", error);
      toast({ title: "Error", description: "Failed to import playlist", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualUrlsSubmit = async () => {
    if (!manualUrls.trim()) {
      toast({ title: "Error", description: "Please enter at least one video URL", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const urls = manualUrls.split("\n").filter(url => url.trim());
      const videos: VideoData[] = [];

      for (let i = 0; i < urls.length; i++) {
        const url = urls[i].trim();
        const videoId = extractVideoId(url);
        
        if (videoId) {
          videos.push({
            title: `Video ${i + 1}`,
            video_url: `https://www.youtube.com/watch?v=${videoId}`,
            description: "",
            order_index: i,
          });
        }
      }

      if (videos.length === 0) {
        toast({ title: "Error", description: "No valid YouTube URLs found", variant: "destructive" });
        return;
      }

      const videosToInsert = videos.map(video => ({
        ...video,
        course_id: courseId,
        video_source: "youtube_single" as const,
      }));

      const { error } = await supabase
        .from("course_videos")
        .insert(videosToInsert);

      if (error) throw error;

      // Update course video count
      const { error: updateError } = await supabase
        .from("courses")
        .update({ video_count: videos.length })
        .eq("id", courseId);

      if (updateError) throw updateError;

      toast({ title: "Success", description: `Added ${videos.length} videos successfully` });
      setManualUrls("");
      onVideosAdded();
      onClose();
    } catch (error) {
      console.error("Error adding videos:", error);
      toast({ title: "Error", description: "Failed to add videos", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...files]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleFileUpload = async () => {
    if (selectedFiles.length === 0) {
      toast({ title: "Error", description: "Please select at least one video file", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const videos: VideoData[] = [];

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const fileExt = file.name.split(".").pop();
        const fileName = `${courseId}/${Date.now()}_${i}.${fileExt}`;

        setUploadProgress(prev => ({ ...prev, [file.name]: 0 }));

        const { error: uploadError, data } = await supabase.storage
          .from("course-videos")
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        setUploadProgress(prev => ({ ...prev, [file.name]: 100 }));

        const { data: urlData } = supabase.storage
          .from("course-videos")
          .getPublicUrl(fileName);

        videos.push({
          title: file.name.replace(/\.[^/.]+$/, ""),
          video_url: urlData.publicUrl,
          description: "",
          order_index: i,
        });
      }

      const videosToInsert = videos.map(video => ({
        ...video,
        course_id: courseId,
        video_source: "uploaded" as const,
      }));

      const { error } = await supabase
        .from("course_videos")
        .insert(videosToInsert);

      if (error) throw error;

      // Update course video count
      const { data: existingVideos } = await supabase
        .from("course_videos")
        .select("id")
        .eq("course_id", courseId);

      const totalVideos = (existingVideos?.length || 0);
      
      const { error: updateError } = await supabase
        .from("courses")
        .update({ video_count: totalVideos })
        .eq("id", courseId);

      if (updateError) throw updateError;

      toast({ title: "Success", description: `Uploaded ${videos.length} videos successfully` });
      setSelectedFiles([]);
      setUploadProgress({});
      onVideosAdded();
      onClose();
    } catch (error) {
      console.error("Error uploading videos:", error);
      toast({ title: "Error", description: "Failed to upload videos", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Videos to Course</DialogTitle>
          <DialogDescription>
            Choose how you want to add videos: import from YouTube playlist, enter URLs manually, or upload files
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="manage" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="manage">
              <Eye className="h-4 w-4 mr-2" />
              Manage
            </TabsTrigger>
            <TabsTrigger value="playlist">
              <List className="h-4 w-4 mr-2" />
              Playlist
            </TabsTrigger>
            <TabsTrigger value="manual">
              <LinkIcon className="h-4 w-4 mr-2" />
              Manual URLs
            </TabsTrigger>
            <TabsTrigger value="upload">
              <Upload className="h-4 w-4 mr-2" />
              Upload
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manage" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Existing Videos ({existingVideos.length})</Label>
              {existingVideos.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No videos added yet. Use the other tabs to add videos.
                </p>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead className="w-32">Source</TableHead>
                        <TableHead className="w-32 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {existingVideos.map((video, index) => (
                        <TableRow key={video.id}>
                          <TableCell className="font-medium">{index + 1}</TableCell>
                          <TableCell>
                            {editingVideoId === video.id ? (
                              <Input
                                value={editingTitle}
                                onChange={(e) => setEditingTitle(e.target.value)}
                                className="h-8"
                                autoFocus
                              />
                            ) : (
                              <span>{video.title}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground capitalize">
                            {video.video_source.replace(/_/g, " ")}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {editingVideoId === video.id ? (
                                <>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleSaveVideo(video.id)}
                                  >
                                    <Save className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      setEditingVideoId(null);
                                      setEditingTitle("");
                                    }}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleEditVideo(video)}
                                  >
                                    Edit
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDeleteVideo(video.id)}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="playlist" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="playlist-url">YouTube Playlist URL</Label>
              <Input
                id="playlist-url"
                value={playlistUrl}
                onChange={(e) => setPlaylistUrl(e.target.value)}
                placeholder="https://www.youtube.com/playlist?list=..."
              />
              <p className="text-sm text-muted-foreground">
                Enter the full YouTube playlist URL to import all videos
              </p>
            </div>
            <Button 
              onClick={handlePlaylistImport} 
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                "Import Playlist"
              )}
            </Button>
          </TabsContent>

          <TabsContent value="manual" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="manual-urls">YouTube Video URLs</Label>
              <Textarea
                id="manual-urls"
                value={manualUrls}
                onChange={(e) => setManualUrls(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                rows={8}
              />
              <p className="text-sm text-muted-foreground">
                Enter one YouTube video URL per line
              </p>
            </div>
            <Button 
              onClick={handleManualUrlsSubmit} 
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding Videos...
                </>
              ) : (
                "Add Videos"
              )}
            </Button>
          </TabsContent>

          <TabsContent value="upload" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="file-upload">Upload Video Files</Label>
              <Input
                id="file-upload"
                type="file"
                accept="video/*"
                multiple
                onChange={handleFileSelect}
                className="cursor-pointer"
              />
              <p className="text-sm text-muted-foreground">
                Select one or multiple video files from your computer
              </p>
            </div>

            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                <Label>Selected Files ({selectedFiles.length})</Label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedFiles.map((file, index) => (
                    <Card key={index}>
                      <CardContent className="p-3 flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                          {uploadProgress[file.name] !== undefined && (
                            <div className="w-full bg-secondary rounded-full h-1.5 mt-2">
                              <div
                                className="bg-primary h-1.5 rounded-full transition-all"
                                style={{ width: `${uploadProgress[file.name]}%` }}
                              />
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index)}
                          disabled={isLoading}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            <Button 
              onClick={handleFileUpload} 
              disabled={isLoading || selectedFiles.length === 0}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                "Upload Videos"
              )}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
