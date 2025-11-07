import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Upload, Link as LinkIcon, List, Loader2, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

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

export const VideoManagement = ({ courseId, isOpen, onClose, onVideosAdded }: VideoManagementProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  
  // YouTube Playlist
  const [playlistUrl, setPlaylistUrl] = useState("");
  
  // Manual URLs
  const [manualUrls, setManualUrls] = useState("");
  
  // File Upload
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

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

        <Tabs defaultValue="manual" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
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
