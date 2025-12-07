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

  // Logger utility
  const log = (level: LogEntry["level"], message: string, data?: any) => {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
    };
    
    setLogs(prev => [...prev, entry]);
    
    // Also log to console with appropriate method
    const consoleData = data ? [message, data] : [message];
    switch (level) {
      case "error":
        console.error(...consoleData);
        break;
      case "warning":
        console.warn(...consoleData);
        break;
      case "success":
        console.log("✅", ...consoleData);
        break;
      default:
        console.log(...consoleData);
    }
  };

  // Log component mount
  useEffect(() => {
    log("info", "MediaCreate component mounted");
    
    // Check environment variables
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    log("info", "Environment check", {
      supabaseUrl: supabaseUrl ? "✓ Set" : "✗ Missing",
      supabaseKey: supabaseKey ? "✓ Set" : "✗ Missing",
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
      
      // Validate file sizes
      const invalidFiles = files.filter(f => f.size > 50 * 1024 * 1024);
      if (invalidFiles.length > 0) {
        log("error", "Some files exceed size limit", {
          invalidFiles: invalidFiles.map(f => ({
            name: f.name,
            size: `${(f.size / 1024 / 1024).toFixed(2)}MB`,
          })),
        });
        setErrorMessage("Some files exceed 50MB limit and were not added.");
        setTimeout(() => setErrorMessage(""), 5000);
        return;
      }
      
      log("success", "All files passed validation");
      
      // Create preview URLs
      const urls = files.map(file => {
        const url = URL.createObjectURL(file);
        log("info", `Created preview URL for ${file.name}`, { url });
        return url;
      });
      
      setMediaFiles(files);
      setPreviewUrls(urls);
      setUploadStatus("idle");
      
      log("success", "Files and previews set successfully");
    } catch (error) {
      log("error", "Error in handleFileChange", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  };

  const removeFile = (index: number) => {
    log("info", `Removing file at index ${index}`);
    
    try {
      const fileToRemove = mediaFiles[index];
      log("info", `Removing file: ${fileToRemove.name}`);
      
      const newFiles = mediaFiles.filter((_, i) => i !== index);
      const newUrls = previewUrls.filter((_, i) => i !== index);
      
      // Revoke old URL to prevent memory leaks
      URL.revokeObjectURL(previewUrls[index]);
      log("info", `Revoked preview URL for ${fileToRemove.name}`);
      
      setMediaFiles(newFiles);
      setPreviewUrls(newUrls);
      
      log("success", `File removed. Remaining files: ${newFiles.length}`);
    } catch (error) {
      log("error", "Error in removeFile", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleCategoryToggle = (cat: string) => {
    log("info", `Category toggle: ${cat}`);
    
    setSelectedCategories((prev) => {
      const newCategories = prev.includes(cat) 
        ? prev.filter((c) => c !== cat) 
        : [...prev, cat];
      
      log("info", "Categories updated", {
        action: prev.includes(cat) ? "removed" : "added",
        category: cat,
        newCategories,
      });
      
      return newCategories;
    });
  };

  const handleSubmit = async () => {
    log("info", "=== UPLOAD PROCESS STARTED ===");
    
    // Validation
    if (mediaFiles.length === 0) {
      log("error", "Validation failed: No files selected");
      setErrorMessage("Please select at least one file to upload.");
      return;
    }
    log("success", `Validation passed: ${mediaFiles.length} file(s) selected`);
    
    if (!caption.trim()) {
      log("error", "Validation failed: Caption is empty");
      setErrorMessage("Please provide a caption for your media.");
      return;
    }
    log("success", `Validation passed: Caption provided (${caption.length} chars)`);
    
    if (selectedCategories.length === 0) {
      log("error", "Validation failed: No categories selected");
      setErrorMessage("Please select at least one category.");
      return;
    }
    log("success", `Validation passed: ${selectedCategories.length} categories selected`, {
      categories: selectedCategories,
    });

    setIsUploading(true);
    setUploadStatus("idle");
    setErrorMessage("");

    try {
      // Get auth token from Supabase
      log("info", "Getting authentication token");
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        log("error", "Authentication failed", { error: sessionError });
        throw new Error("You must be logged in to upload media. Please log in and try again.");
      }
      
      const accessToken = session.access_token;
      log("success", "Authentication token retrieved", { 
        tokenLength: accessToken.length,
        tokenPreview: accessToken.substring(0, 10) + "..." 
      });

      // Prepare metadata
      log("info", "Preparing metadata");
      const metadata: any = {};
      if (completionTime) metadata.completion_time = completionTime;
      if (clientSatisfaction) metadata.client_satisfaction = clientSatisfaction;
      if (area) metadata.area = area;
      if (location) metadata.location = location;
      if (projectCost) metadata.project_cost = projectCost;
      
      log("info", "Metadata prepared", { metadata });

      // Create FormData
      log("info", "Creating FormData");
      const formData = new FormData();
      
      mediaFiles.forEach((file, index) => {
        formData.append('files', file);
        log("info", `Added file ${index + 1} to FormData: ${file.name}`);
      });

      const requestData = {
        caption: caption.trim(),
        categories: selectedCategories,
        projectLink: projectLink.trim() || undefined,
        pinToTop,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        altText: altText.trim() || caption.trim(),
      };
      
      log("info", "Request data prepared", { requestData });
      formData.append('data', JSON.stringify(requestData));

      // Get Supabase URL from environment
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      log("info", "Environment variables check", {
        supabaseUrl: supabaseUrl ? `✓ ${supabaseUrl}` : "✗ MISSING",
      });
      
      if (!supabaseUrl) {
        throw new Error("VITE_SUPABASE_URL is not configured");
      }

      // Construct endpoint URL
      const endpoint = `${supabaseUrl}/functions/v1/upload-media`;
      log("info", `Sending request to: ${endpoint}`);
      
      // Make request with timeout
      log("info", "Initiating fetch request");
      const startTime = Date.now();
      
      // Set upload progress
      setUploadProgress(10);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout
      
      try {
        setUploadProgress(30);
        
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
          body: formData,
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        setUploadProgress(70);
        
        const duration = Date.now() - startTime;
        log("info", `Response received (${duration}ms)`, {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
        });

        // Parse response
        log("info", "Parsing response JSON");
        setUploadProgress(80);
        const result = await response.json();
        setUploadProgress(90);
        log("info", "Response parsed", { result });

        if (!response.ok) {
          log("error", "Upload failed - non-OK response", {
            status: response.status,
            statusText: response.statusText,
            error: result.error,
            fullResponse: result,
          });
          throw new Error(result.error || `Upload failed with status ${response.status}`);
        }

        setUploadProgress(100);
        log("success", "✅ Upload successful!", {
          uploadedCount: result.data?.length,
          message: result.message,
        });
      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          throw new Error('Upload timed out. Please try uploading smaller files or fewer files at once.');
        }
        throw fetchError;
      }
      
      setUploadStatus("success");
      
      // Reset state
      log("info", "Resetting form state in 3 seconds...");
      setTimeout(() => {
        log("info", "Clearing form data");
        setMediaFiles([]);
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
        setUploadStatus("idle");
        log("success", "Form reset complete");
      }, 3000);

    } catch (error) {
      log("error", "❌ UPLOAD FAILED", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        type: error?.constructor?.name,
      });
      
      setUploadStatus("error");
      setErrorMessage(
        error instanceof Error 
          ? error.message 
          : "Failed to upload media. Please check the logs for details."
      );
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      log("info", "=== UPLOAD PROCESS ENDED ===");
    }
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith("video")) return "🎥";
    if (file.type.startsWith("audio")) return "🎵";
    if (file.type === "image/gif") return "🎞️";
    return "🖼️";
  };

  const clearLogs = () => {
    log("info", "Clearing logs");
    setLogs([]);
  };

  const exportLogs = () => {
    const logsText = logs.map(log => 
      `[${log.timestamp}] ${log.level.toUpperCase()}: ${log.message}${
        log.data ? '\n' + JSON.stringify(log.data, null, 2) : ''
      }`
    ).join('\n\n');
    
    const blob = new Blob([logsText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `media-upload-logs-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    
    log("success", "Logs exported to file");
  };

  const getLogColor = (level: LogEntry["level"]) => {
    switch (level) {
      case "error": return "text-red-600 dark:text-red-400";
      case "warning": return "text-yellow-600 dark:text-yellow-400";
      case "success": return "text-green-600 dark:text-green-400";
      default: return "text-blue-600 dark:text-blue-400";
    }
  };

  const getLogIcon = (level: LogEntry["level"]) => {
    switch (level) {
      case "error": return "❌";
      case "warning": return "⚠️";
      case "success": return "✅";
      default: return "ℹ️";
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Create New Media
        </h1>
        <p className="text-muted-foreground">
          Upload stunning visuals to showcase Dream Construct's latest projects and achievements.
        </p>
        
        {/* Debug Toggle */}
        <div className="mt-4 flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowLogs(!showLogs)}
            className="gap-2"
          >
            <Terminal className="w-4 h-4" />
            {showLogs ? "Hide" : "Show"} Debug Logs ({logs.length})
          </Button>
          {logs.length > 0 && (
            <>
              <Button variant="ghost" size="sm" onClick={clearLogs}>
                Clear
              </Button>
              <Button variant="ghost" size="sm" onClick={exportLogs}>
                Export
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Debug Logs Panel */}
      {showLogs && (
        <Card className="mb-6 p-4 bg-slate-950 text-slate-50 max-h-96 overflow-y-auto font-mono text-xs">
          <div className="space-y-2">
            {logs.length === 0 ? (
              <p className="text-slate-400">No logs yet...</p>
            ) : (
              logs.map((log, idx) => (
                <div key={idx} className="border-b border-slate-800 pb-2">
                  <div className="flex items-start gap-2">
                    <span>{getLogIcon(log.level)}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={getLogColor(log.level)}>[{log.level.toUpperCase()}]</span>
                        <span className="text-slate-400 text-[10px]">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-slate-200 mt-1">{log.message}</p>
                      {log.data && (
                        <pre className="text-slate-400 mt-1 text-[10px] overflow-x-auto">
                          {JSON.stringify(log.data, null, 2)}
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

      <Card className="p-8 bg-card shadow-xl border-2">
        <div className="space-y-8">
          {/* File Upload Section */}
          <div className="space-y-4">
            <Label htmlFor="media" className="text-lg font-semibold flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Media Files
            </Label>
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer">
              <Input
                id="media"
                type="file"
                accept="image/*,video/*,audio/*,.gif"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
              <label htmlFor="media" className="cursor-pointer">
                <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-semibold mb-2 text-primary">Click to upload media</p>
                <p className="text-sm text-muted-foreground">
                  Images, videos, audio, or GIFs up to 50MB each
                </p>
              </label>
            </div>

            {/* File Previews */}
            {previewUrls.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
                {mediaFiles.map((file, idx) => (
                  <div key={idx} className="relative group">
                    <div className="aspect-square rounded-lg border-2 border-border overflow-hidden bg-muted">
                      {file.type.startsWith("video") ? (
                        <video 
                          src={previewUrls[idx]} 
                          controls 
                          loop 
                          muted 
                          className="w-full h-full object-cover"
                        />
                      ) : file.type.startsWith("audio") ? (
                        <div className="flex items-center justify-center h-full flex-col gap-4 p-4">
                          <span className="text-6xl">🎵</span>
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
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:scale-110"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xl">{getFileIcon(file)}</span>
                      <span className="text-xs text-muted-foreground truncate flex-1">
                        {file.name}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Caption */}
          <div>
            <Label htmlFor="caption" className="text-lg font-semibold">Caption *</Label>
            <Textarea
              id="caption"
              value={caption}
              onChange={e => setCaption(e.target.value)}
              placeholder="Describe this stunning project..."
              className="mt-2 min-h-[100px]"
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground mt-1">{caption.length}/500 characters</p>
          </div>

          {/* Alt Text */}
          <div>
            <Label htmlFor="altText" className="text-lg font-semibold">Alt Text (SEO)</Label>
            <Input
              id="altText"
              value={altText}
              onChange={e => setAltText(e.target.value)}
              placeholder="Brief description for accessibility..."
              className="mt-2"
              maxLength={200}
            />
          </div>

          {/* Categories */}
          <div>
            <Label className="text-lg font-semibold">Category Tags *</Label>
            <div className="flex flex-wrap gap-2 mt-3">
              {categories.map(cat => (
                <Badge
                  key={cat}
                  className={`cursor-pointer px-4 py-2 text-sm transition-all hover:scale-105 ${
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

          {/* Metadata Section */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4">Project Details (Optional)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <div className="md:col-span-2">
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

          {/* Project Link */}
          <div>
            <Label htmlFor="projectLink" className="text-lg font-semibold">Project Link</Label>
            <Input
              id="projectLink"
              type="text"
              value={projectLink}
              onChange={e => setProjectLink(e.target.value)}
              placeholder="/showcase/prj-2025-001"
              className="mt-2"
            />
          </div>

          {/* Pin to Top */}
          <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
            <Switch
              id="pinToTop"
              checked={pinToTop}
              onCheckedChange={setPinToTop}
            />
            <div>
              <Label htmlFor="pinToTop" className="font-semibold cursor-pointer">
                Pin to Top (Featured)
              </Label>
              <p className="text-sm text-muted-foreground">
                Featured posts appear at the top of the gallery
              </p>
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="flex items-center gap-2 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <AlertCircle className="w-5 h-5 text-destructive" />
              <p className="text-sm text-destructive">{errorMessage}</p>
            </div>
          )}

          {/* Success Message */}
          {uploadStatus === "success" && (
            <div className="flex items-center gap-2 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <p className="text-sm text-green-600 dark:text-green-400">
                Media uploaded successfully! 🎉
              </p>
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-4 space-y-3">
            {isUploading && uploadProgress > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Uploading...</span>
                  <span>{uploadProgress}%</span>
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
              className="w-full bg-primary hover:bg-primary/90 text-background font-semibold py-6 text-lg rounded-xl shadow-lg flex items-center justify-center gap-2"
              disabled={isUploading || mediaFiles.length === 0}
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Uploading... {uploadProgress > 0 && `${uploadProgress}%`}
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5 mr-2" />
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