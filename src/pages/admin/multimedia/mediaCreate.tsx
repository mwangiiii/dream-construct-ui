// src/pages/admin/multimedia/MediaCreate.tsx
// PRODUCTION READY - WITH ALL FIXES

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Upload, X, CheckCircle, AlertCircle, Loader2, Terminal } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

const categories = [
  "Luxury Villa",
  "Completed 2025",
  "Before & After",
  "Client Testimonial",
  "Apartments",
  "Commercial",
  "Renovations",
  "Drone Shots",
];

interface LogEntry {
  timestamp: string;
  level: "info" | "warning" | "error" | "success";
  message: string;
  data?: any;
}

export default function MediaCreate() {
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [caption, setCaption] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [projectLink, setProjectLink] = useState("");
  const [pinToTop, setPinToTop] = useState(false);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [altText, setAltText] = useState("");

  // Metadata fields
  const [completionTime, setCompletionTime] = useState("");
  const [clientSatisfaction, setClientSatisfaction] = useState("");
  const [area, setArea] = useState("");
  const [location, setLocation] = useState("");
  const [projectCost, setProjectCost] = useState("");

  // UI state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);

  // Debug logging state
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  const log = (level: LogEntry["level"], message: string, data?: any) => {
    const entry: LogEntry = { timestamp: new Date().toISOString(), level, message, data };
    setLogs(prev => [...prev, entry]);
  };

  useEffect(() => {
    log("info", "MediaCreate component mounted");
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    log("info", "Environment check", {
      supabaseUrl: supabaseUrl ? "Set" : "Missing",
      supabaseKey: supabaseKey ? "Set" : "Missing",
    });
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    log("info", "File input change event triggered");
    try {
      const files = Array.from(e.target.files || []);
      log("info", `Selected ${files.length} file(s)`, {
        fileNames: files.map(f => f.name),
        fileSizes: files.map(f => `${(f.size / 1024 / 1024).toFixed(2)}MB`),
        fileTypes: files.map(f => f.type),
      });
      const invalidFiles = files.filter(f => f.size > 500 * 1024 * 1024);
      if (invalidFiles.length > 0) {
        log("warning", "Large files detected", {
          files: invalidFiles.map(f => `${f.name} (${(f.size / 1024 / 1024).toFixed(2)}MB)`),
        });
      }
      const urls = files.map(file => URL.createObjectURL(file));
      setMediaFiles(files);
      setPreviewUrls(urls);
      setUploadStatus("idle");
      log("success", "Files and previews ready");
    } catch (error) {
      log("error", "Error in handleFileChange", { error });
    }
  };

  const removeFile = (index: number) => {
    log("info", `Removing file at index ${index}`);
    const newFiles = mediaFiles.filter((_, i) => i !== index);
    const newUrls  = previewUrls.filter((_, i) => i !== index);
    URL.revokeObjectURL(previewUrls[index]);
    setMediaFiles(newFiles);
    setPreviewUrls(newUrls);
    log("success", `File removed. Remaining: ${newFiles.length}`);
  };

  const handleCategoryToggle = (cat: string) => {
    setSelectedCategories(prev => {
      const newCats = prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat];
      log("info", "Categories updated", {
        action: prev.includes(cat) ? "removed" : "added",
        category: cat,
        newCats,
      });
      return newCats;
    });
  };

  const handleSubmit = async () => {
    log("info", "=== UPLOAD PROCESS STARTED (Presigned URLs) ===");

    if (mediaFiles.length === 0) {
      log("error", "No files selected");
      setErrorMessage("Please select at least one file.");
      return;
    }
    if (!caption.trim()) {
      log("error", "Caption missing");
      setErrorMessage("Please provide a caption.");
      return;
    }
    if (selectedCategories.length === 0) {
      log("error", "No categories selected");
      setErrorMessage("Please select at least one category.");
      return;
    }

    setIsUploading(true);
    setUploadStatus("idle");
    setErrorMessage("");
    setUploadProgress(5);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("You must be logged in");
      log("success", "Authenticated", { user: session.user.email });

      setUploadProgress(10);
      log("info", "Requesting presigned URLs...");
      const fileInfo = mediaFiles.map(f => ({ name: f.name, type: f.type, size: f.size }));

      const genRes = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-presigned-urls`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ files: fileInfo }),
        }
      );
      if (!genRes.ok) {
        const err = await genRes.text();
        throw new Error(`Failed to get upload URLs: ${err}`);
      }
      const { urls } = await genRes.json();
      log("success", "Presigned URLs received", { count: urls.length });

      const uploadedFiles = [];
      for (let i = 0; i < mediaFiles.length; i++) {
        const file    = mediaFiles[i];
        const urlData = urls[i];
        log("info", `Uploading ${i + 1}/${mediaFiles.length}: ${file.name}`);
        const uploadRes = await fetch(urlData.signedUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });
        if (!uploadRes.ok) {
          const errorText = await uploadRes.text();
          throw new Error(`Upload failed for ${file.name}: ${errorText}`);
        }
        uploadedFiles.push({
          path: urlData.path,
          publicUrl: urlData.publicUrl,
          mimeType: file.type,
          size: file.size,
        });
        setUploadProgress(20 + ((i + 1) / mediaFiles.length) * 60);
        log("success", `Uploaded: ${file.name}`);
      }

      setUploadProgress(85);
      log("info", "Finalizing upload in database...");
      const finalizeRes = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/finalize-media-upload`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            files: uploadedFiles,
            caption: caption.trim(),
            categories: selectedCategories,
            projectLink: projectLink.trim() || undefined,
            pinToTop,
            metadata: {
              completion_time:    completionTime    || undefined,
              client_satisfaction: clientSatisfaction || undefined,
              area:               area              || undefined,
              location:           location          || undefined,
              project_cost:       projectCost       || undefined,
            },
            altText: altText.trim() || caption.trim(),
          }),
        }
      );
      if (!finalizeRes.ok) {
        const err = await finalizeRes.text();
        throw new Error(`Database save failed: ${err}`);
      }
      const result = await finalizeRes.json();
      log("success", "Database records created", { count: result.data.length });

      setUploadProgress(100);
      setUploadStatus("success");
      log("success", "🎉 ALL MEDIA UPLOADED SUCCESSFULLY!");

      setTimeout(() => {
        setMediaFiles([]);
        previewUrls.forEach(URL.revokeObjectURL);
        setPreviewUrls([]);
        setCaption("");
        setSelectedCategories([]);
        setProjectLink("");
        setPinToTop(false);
        setAltText("");
        setCompletionTime("");
        setClientSatisfaction("");
        setArea("");
        setLocation("");
        setProjectCost("");
        setUploadProgress(0);
        setUploadStatus("idle");
        log("info", "Form reset after success");
      }, 3000);

    } catch (error: any) {
      log("error", "❌ UPLOAD FAILED", { error: error.message, stack: error.stack });
      setErrorMessage(error.message || "Upload failed. Check logs for details.");
      setUploadStatus("error");
    } finally {
      setIsUploading(false);
      log("info", "=== UPLOAD PROCESS ENDED ===");
    }
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith("video"))   return "🎥";
    if (file.type.startsWith("audio"))   return "🎵";
    if (file.type === "image/gif")       return "📹";
    return "🖼️";
  };

  const clearLogs = () => { setLogs([]); log("info", "Logs cleared"); };

  const exportLogs = () => {
    const text = logs.map(l =>
      `[${new Date(l.timestamp).toLocaleTimeString()}] ${l.level.toUpperCase()}: ${l.message}${
        l.data ? "\n" + JSON.stringify(l.data, null, 2) : ""
      }`
    ).join("\n\n");
    const blob = new Blob([text], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `upload-logs-${Date.now()}.txt`;
    a.click();
    log("success", "Logs exported");
  };

  const getLogColor = (level: LogEntry["level"]) => {
    switch (level) {
      case "error":   return "text-red-600 dark:text-red-400";
      case "warning": return "text-yellow-600 dark:text-yellow-400";
      case "success": return "text-green-600 dark:text-green-400";
      default:        return "text-blue-600 dark:text-blue-400";
    }
  };

  const getLogIcon = (level: LogEntry["level"]) => {
    switch (level) {
      case "error":   return "❌";
      case "warning": return "⚠️";
      case "success": return "✅";
      default:        return "ℹ️";
    }
  };

  return (
    // Tighter horizontal padding on mobile, original on desktop
    <div className="w-full overflow-x-hidden max-w-4xl mx-auto py-8 sm:py-12 px-3 sm:px-4">

      {/* Debug Panel */}
      {showLogs && (
        <Card className="mb-6 p-3 sm:p-4 bg-slate-950 text-slate-50 max-h-80 sm:max-h-96 overflow-y-auto font-mono text-xs">
          <div className="space-y-2">
            {logs.length === 0 ? (
              <p className="text-slate-400">No logs yet...</p>
            ) : (
              logs.map((entry, i) => (
                <div key={i} className="border-b border-slate-800 pb-2">
                  <div className="flex items-start gap-2">
                    <span>{getLogIcon(entry.level)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={getLogColor(entry.level)}>[{entry.level.toUpperCase()}]</span>
                        <span className="text-slate-400 text-[10px]">
                          {new Date(entry.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-slate-200 mt-1 break-words">{entry.message}</p>
                      {entry.data && (
                        <pre className="text-slate-400 mt-1 text-[10px] overflow-x-auto whitespace-pre-wrap break-words">
                          {JSON.stringify(entry.data, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      )}

      <Card className="p-4 sm:p-8 bg-card shadow-xl border-2">
        <div className="space-y-6 sm:space-y-8">

          {/* ── File Upload ── */}
          <div className="space-y-4">
            <Label htmlFor="media" className="text-base sm:text-lg font-semibold flex items-center gap-2">
              <Upload className="w-4 h-4 sm:w-5 sm:h-5" /> Media Files
            </Label>

            <div className="border-2 border-dashed border-border rounded-lg p-6 sm:p-8 text-center hover:border-primary transition-colors cursor-pointer">
              <Input
                id="media"
                type="file"
                accept="image/*,video/*,audio/*,.gif"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
              <label htmlFor="media" className="cursor-pointer">
                <Upload className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 text-muted-foreground" />
                <p className="text-base sm:text-lg font-semibold mb-2 text-primary">Click to upload media</p>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Images, videos, audio, or GIFs (up to 500MB per file, max 20 files)
                </p>
              </label>
            </div>

            {previewUrls.length > 0 && (
              /*
                Mobile:  1 column (full-width cards, no overflow)
                Desktop: 2-col → 3-col grid (unchanged)
              */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mt-4 sm:mt-6">
                {mediaFiles.map((file, idx) => (
                  <div key={idx} className="relative group">
                    <div className="aspect-square rounded-lg border-2 border-border overflow-hidden bg-muted">
                      {file.type.startsWith("video") ? (
                        <video
                          src={previewUrls[idx]}
                          controls loop muted
                          className="w-full h-full object-cover"
                        />
                      ) : file.type.startsWith("audio") ? (
                        <div className="flex items-center justify-center h-full flex-col gap-3 sm:gap-4 p-3 sm:p-4">
                          <span className="text-5xl sm:text-6xl">🎵</span>
                          <audio src={previewUrls[idx]} controls className="w-full" />
                        </div>
                      ) : (
                        <img
                          src={previewUrls[idx]}
                          alt={`Preview ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>

                    {/* Remove button — always visible on mobile, hover on desktop */}
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      className="
                        absolute -top-2 -right-2
                        bg-destructive text-destructive-foreground
                        rounded-full p-1.5 shadow-lg
                        opacity-100 sm:opacity-0 sm:group-hover:opacity-100
                        transition-opacity hover:scale-110
                      "
                    >
                      <X className="w-4 h-4" />
                    </button>

                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-lg sm:text-xl">{getFileIcon(file)}</span>
                      <span className="text-xs text-muted-foreground truncate flex-1">{file.name}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Caption ── */}
          <div>
            <Label htmlFor="caption" className="text-base sm:text-lg font-semibold">Caption *</Label>
            <Textarea
              id="caption"
              value={caption}
              onChange={e => setCaption(e.target.value)}
              placeholder="Describe this stunning project..."
              className="mt-2 min-h-[90px] sm:min-h-[100px]"
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground mt-1">{caption.length}/500 characters</p>
          </div>

          {/* ── Alt Text ── */}
          <div>
            <Label htmlFor="altText" className="text-base sm:text-lg font-semibold">Alt Text (SEO)</Label>
            <Input
              id="altText"
              value={altText}
              onChange={e => setAltText(e.target.value)}
              placeholder="Brief description for accessibility..."
              className="mt-2"
              maxLength={200}
            />
          </div>

          {/* ── Categories ── */}
          <div>
            <Label className="text-base sm:text-lg font-semibold">Category Tags *</Label>
            {/*
              flex-wrap already handles both mobile and desktop naturally —
              badges wrap to new lines instead of overflowing horizontally.
            */}
            <div className="flex flex-wrap gap-2 mt-3">
              {categories.map(cat => (
                <Badge
                  key={cat}
                  className={`cursor-pointer px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm transition-all hover:scale-105 ${
                    selectedCategories.includes(cat)
                      ? "bg-primary text-primary-foreground shadow-lg"
                      : "bg-muted hover:bg-muted/80"
                  }`}
                  onClick={() => handleCategoryToggle(cat)}
                >
                  {cat}
                </Badge>
              ))}
            </div>
          </div>

          {/* ── Project Details ── */}
          <div className="border-t pt-5 sm:pt-6">
            <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Project Details (Optional)</h3>
            {/*
              Mobile:  single-column stack (all inputs full width)
              Desktop: 2-column grid (unchanged)
            */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <Label htmlFor="completionTime">Completion Time</Label>
                <Input
                  id="completionTime"
                  value={completionTime}
                  onChange={e => setCompletionTime(e.target.value)}
                  placeholder="e.g., 8 months"
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="clientSatisfaction">Client Satisfaction</Label>
                <Input
                  id="clientSatisfaction"
                  value={clientSatisfaction}
                  onChange={e => setClientSatisfaction(e.target.value)}
                  placeholder="e.g., 10/10"
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="area">Area</Label>
                <Input
                  id="area"
                  value={area}
                  onChange={e => setArea(e.target.value)}
                  placeholder="e.g., 4,200 sq ft"
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  placeholder="e.g., Karen, Nairobi"
                  className="mt-2"
                />
              </div>
              {/* Full-width on both mobile and desktop */}
              <div className="sm:col-span-2">
                <Label htmlFor="projectCost">Project Cost</Label>
                <Input
                  id="projectCost"
                  value={projectCost}
                  onChange={e => setProjectCost(e.target.value)}
                  placeholder="e.g., KES 45M"
                  className="mt-2"
                />
              </div>
            </div>
          </div>

          {/* ── Project Link ── */}
          <div>
            <Label htmlFor="projectLink" className="text-base sm:text-lg font-semibold">Project Link</Label>
            <Input
              id="projectLink"
              value={projectLink}
              onChange={e => setProjectLink(e.target.value)}
              placeholder="/showcase/prj-2025-001"
              className="mt-2"
            />
          </div>

          {/* ── Pin to Top ── */}
          <div className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-muted/50 rounded-lg">
            <Switch id="pinToTop" checked={pinToTop} onCheckedChange={setPinToTop} />
            <div>
              <Label htmlFor="pinToTop" className="font-semibold cursor-pointer text-sm sm:text-base">
                Pin to Top (Featured)
              </Label>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Featured posts appear at the top of the gallery
              </p>
            </div>
          </div>

          {/* ── Error ── */}
          {errorMessage && (
            <div className="flex items-start gap-2 p-3 sm:p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs sm:text-sm text-destructive">{errorMessage}</p>
            </div>
          )}

          {/* ── Success ── */}
          {uploadStatus === "success" && (
            <div className="flex items-start gap-2 p-3 sm:p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
              <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 shrink-0 mt-0.5" />
              <p className="text-xs sm:text-sm text-green-600 dark:text-green-400">
                Media uploaded successfully!
              </p>
            </div>
          )}

          {/* ── Progress + Submit ── */}
          <div className="pt-3 sm:pt-4 space-y-3">
            {isUploading && uploadProgress > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs sm:text-sm text-muted-foreground">
                  <span>Uploading...</span>
                  <span>{Math.round(uploadProgress)}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-primary h-full transition-all duration-300 ease-out"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            <Button
              onClick={handleSubmit}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-5 sm:py-6 text-base sm:text-lg rounded-xl shadow-lg flex items-center justify-center gap-2"
              disabled={isUploading || mediaFiles.length === 0}
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                  Uploading... {uploadProgress > 0 && `${Math.round(uploadProgress)}%`}
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>Upload Media</span>
                </>
              )}
            </Button>
          </div>

        </div>
      </Card>
    </div>
  );
}