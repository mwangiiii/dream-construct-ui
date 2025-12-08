import React, { useEffect, useState, useRef } from "react";
import { Eye, EyeOff, Upload, X, ZoomIn, RotateCw, ArrowLeftRight, ArrowUpDown } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  CardDescription,
} from "@/components/ui/card";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Alert,
  AlertTitle,
  AlertDescription,
} from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { getCurrentUser, updateProfile, updatePassword } from "@/lib/auth";

const SettingsPage = () => {
  const [user, setUser] = useState<any>(null);
  const [editMode, setEditMode] = useState(false);
  const [profile, setProfile] = useState({
    full_name: "",
    avatar_url: "",
    email: "",
    phone: "",
    job_title: "",
  });

  // === AVATAR UPLOAD STATES ===
  const [uploading, setUploading] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // === IMAGE CROP STATES ===
  const [showCropDialog, setShowCropDialog] = useState(false);
  const [cropImage, setCropImage] = useState<string>("");
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const [passwordModal, setPasswordModal] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [privacyModal, setPrivacyModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState(false);

  useEffect(() => {
    getCurrentUser().then((u) => {
      if (u) {
        setUser(u);
        setProfile({
          full_name: u.profile.full_name || "",
          avatar_url: u.profile.avatar_url || "",
          email: u.email || "",
          phone: u.profile.phone || "",
          job_title: u.profile.job_title || "",
        });
        setPreviewUrl(u.profile.avatar_url || "");
      }
    });
  }, []);

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProfile({ ...profile, [e.target.name]: e.target.value });
  };

  // ==================== IMAGE CROP LOGIC ====================
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    setUploadSuccess(false);

    // if (!file.type.startsWith("image/")) {
    //   setError("Please select a valid image file");
    //   return;
    // }

    if (file.size > 50 * 1024 * 1024) {
      setError("Image must be under 50MB");
      return;
    }

    // Read file and show crop dialog
    const reader = new FileReader();
    reader.onloadend = () => {
      setCropImage(reader.result as string);
      setZoom(1);
      setRotation(0);
      setOffsetX(0);
      setOffsetY(0);
      setShowCropDialog(true);
    };
    reader.readAsDataURL(file);
    setAvatarFile(file);
  };

  const drawCroppedImage = () => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size to 800x800 for high quality
    const size = 800;
    canvas.width = size;
    canvas.height = size;

    // Clear canvas
    ctx.clearRect(0, 0, size, size);

    // Save context state
    ctx.save();

    // Move to center
    ctx.translate(size / 2, size / 2);

    // Apply rotation
    ctx.rotate((rotation * Math.PI) / 180);

    // Apply offset (panning)
    ctx.translate(offsetX, offsetY);

    // Calculate dimensions
    const scale = zoom;
    const scaledWidth = image.width * scale;
    const scaledHeight = image.height * scale;

    // Draw image centered
    ctx.drawImage(
      image,
      -scaledWidth / 2,
      -scaledHeight / 2,
      scaledWidth,
      scaledHeight
    );

    // Restore context
    ctx.restore();
  };

  useEffect(() => {
    if (showCropDialog && imageRef.current?.complete) {
      drawCroppedImage();
    }
  }, [zoom, rotation, offsetX, offsetY, showCropDialog]);

  const handleImageLoad = () => {
    drawCroppedImage();
  };

  const handleCropConfirm = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Convert canvas to blob
    canvas.toBlob((blob) => {
      if (!blob) return;

      // Create a new file from the blob
      const croppedFile = new File([blob], avatarFile?.name || "avatar.jpg", {
        type: "image/jpeg",
        lastModified: Date.now(),
      });

      setAvatarFile(croppedFile);
      
      // Update preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(croppedFile);

      setShowCropDialog(false);
    }, "image/jpeg", 0.95);
  };

  const handleCropCancel = () => {
    setShowCropDialog(false);
    setAvatarFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // ==================== AVATAR UPLOAD LOGIC ====================
  const uploadAvatar = async () => {
    if (!avatarFile || !user) {
      setError("No file selected or user not authenticated");
      return;
    }

    setUploading(true);
    setError("");
    setUploadSuccess(false);

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session?.access_token) {
        throw new Error("Not authenticated. Please log in again.");
      }

      // Get Supabase URL from the client
      const supabaseUrl = supabase.supabaseUrl;

      if (!supabaseUrl) {
        throw new Error("Supabase URL not configured");
      }

      const formData = new FormData();
      formData.append("file", avatarFile);

      console.log("Uploading avatar to:", `${supabaseUrl}/functions/v1/upload-avatar`);
      console.log("File details:", {
        fileName: avatarFile.name,
        fileSize: avatarFile.size,
        fileType: avatarFile.type,
        userId: user.id
      });

      const res = await fetch(
        `${supabaseUrl}/functions/v1/upload-avatar`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: formData,
        }
      );

      const data = await res.json();

      console.log("Upload response:", data);

      if (!res.ok || !data.success) {
        throw new Error(data.error || `Upload failed with status ${res.status}`);
      }

      const refreshed = await getCurrentUser();
      if (refreshed) {
        setUser(refreshed);
        setProfile(prev => ({ 
          ...prev, 
          avatar_url: data.avatar_url 
        }));
        setPreviewUrl(data.avatar_url);
      }

      setAvatarFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 4000);

    } catch (err: any) {
      console.error("Avatar upload error:", err);
      setError(err.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const removeAvatar = async () => {
    if (!user || !profile.avatar_url) return;

    setLoading(true);
    setError("");

    try {
      const urlParts = profile.avatar_url.split("/");
      const fileName = urlParts[urlParts.length - 1].split("?")[0];
      const filePath = `${user.id}/${fileName}`;

      console.log("Removing avatar:", filePath);

      const { error: deleteError } = await supabase.storage
        .from("profile-pictures")
        .remove([filePath]);

      if (deleteError) {
        console.error("Delete error:", deleteError);
        throw deleteError;
      }

      await updateProfile(user.id, { avatar_url: null });

      const refreshed = await getCurrentUser();
      if (refreshed) {
        setUser(refreshed);
        setProfile((prev) => ({ ...prev, avatar_url: "" }));
        setPreviewUrl("");
      }

      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 4000);

    } catch (err: any) {
      console.error("Remove avatar error:", err);
      setError("Failed to remove avatar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSave = async () => {
    setLoading(true);
    setError("");
    try {
      const updates = {
        full_name: profile.full_name.trim(),
        phone: profile.phone.trim() || null,
        job_title: profile.job_title.trim() || null,
      };
      await updateProfile(user.id, updates);
      const refreshedUser = await getCurrentUser();
      if (refreshedUser) {
        setUser(refreshedUser);
      }
      setEditMode(false);
    } catch (err) {
      setError("Failed to update profile.");
    }
    setLoading(false);
  };

  const handlePasswordChange = async () => {
    setError("");
    if (!oldPassword || !newPassword || !confirmPassword) {
      setError("All fields are required.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }
    setShowConfirmDialog(true);
  };

  const handlePasswordConfirm = async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: oldPassword,
      });
      if (error || !data.user) {
        setError("Current password is incorrect.");
        setLoading(false);
        setShowConfirmDialog(false);
        return;
      }
      await updatePassword(newPassword);
      setPasswordModal(false);
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSuccess(true);
      setTimeout(() => setPasswordSuccess(false), 4000);
    } catch (err) {
      setError("Failed to update password.");
    }
    setLoading(false);
    setShowConfirmDialog(false);
  };

  return (
    <div className="max-w-3xl mx-auto py-10 space-y-8">

      {/* ==================== IMAGE CROP DIALOG ==================== */}
      <Dialog open={showCropDialog} onOpenChange={setShowCropDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Adjust Your Profile Picture</DialogTitle>
            <DialogDescription>
              Zoom, rotate, and position your image perfectly
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Hidden image for loading */}
            <img
              ref={imageRef}
              src={cropImage}
              onLoad={handleImageLoad}
              style={{ display: "none" }}
              alt="Source"
            />
            
            {/* Canvas for preview */}
            <div className="flex justify-center bg-gray-100 rounded-lg p-4">
              <canvas
                ref={canvasRef}
                className="max-w-full h-auto rounded-lg shadow-lg"
                style={{ maxHeight: "400px" }}
              />
            </div>

            {/* Zoom Control */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <ZoomIn className="w-4 h-4" />
                  Zoom
                </Label>
                <span className="text-sm text-muted-foreground">{zoom.toFixed(1)}x</span>
              </div>
              <Slider
                value={[zoom]}
                onValueChange={(value) => setZoom(value[0])}
                min={0.5}
                max={3}
                step={0.1}
                className="w-full"
              />
            </div>

            {/* Rotation Control */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <RotateCw className="w-4 h-4" />
                  Rotation
                </Label>
                <span className="text-sm text-muted-foreground">{rotation}°</span>
              </div>
              <Slider
                value={[rotation]}
                onValueChange={(value) => setRotation(value[0])}
                min={0}
                max={360}
                step={1}
                className="w-full"
              />
            </div>

            {/* Horizontal Position Control */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <ArrowLeftRight className="w-4 h-4" />
                  Horizontal Position
                </Label>
                <span className="text-sm text-muted-foreground">{offsetX}px</span>
              </div>
              <Slider
                value={[offsetX]}
                onValueChange={(value) => setOffsetX(value[0])}
                min={-400}
                max={400}
                step={1}
                className="w-full"
              />
            </div>

            {/* Vertical Position Control */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <ArrowUpDown className="w-4 h-4" />
                  Vertical Position
                </Label>
                <span className="text-sm text-muted-foreground">{offsetY}px</span>
              </div>
              <Slider
                value={[offsetY]}
                onValueChange={(value) => setOffsetY(value[0])}
                min={-400}
                max={400}
                step={1}
                className="w-full"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCropCancel}>
              Cancel
            </Button>
            <Button onClick={handleCropConfirm}>
              Apply & Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== PROFILE PICTURE SECTION ==================== */}
      <GlassCard>
        <CardHeader>
          <CardTitle>Profile Picture</CardTitle>
          <CardDescription>
            Upload a professional photo to be displayed across the platform
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-8">
          <div className="relative group">
            <Avatar className="w-56 h-56 ring-4 ring-background shadow-2xl">
              <AvatarImage src={previewUrl || undefined} alt={profile.full_name} />
              <AvatarFallback className="text-7xl font-bold bg-gradient-to-br from-primary to-accent text-white">
                {profile.full_name?.[0]?.toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            {(previewUrl || uploading) && (
              <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                {uploading ? (
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent" />
                ) : (
                  <Upload className="w-10 h-10 text-white" />
                )}
              </div>
            )}
          </div>

          <div className="w-full max-w-xs space-y-4">
            <input
  ref={fileInputRef}
  type="file"
  accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif,image/gif,image/svg+xml"
  onChange={handleFileSelect}
  className="hidden"
/>

            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              variant="outline"
              className="w-full"
            >
              <Upload className="w-4 h-4 mr-2" />
              {avatarFile ? "Change Image" : "Choose Image"}
            </Button>

            {avatarFile && (
              <div className="flex gap-2">
                <Button onClick={uploadAvatar} disabled={uploading} className="flex-1">
                  {uploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                      Uploading...
                    </>
                  ) : (
                    "Upload"
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setAvatarFile(null);
                    setPreviewUrl(profile.avatar_url);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                    setError("");
                  }}
                  disabled={uploading}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}

            {previewUrl && !avatarFile && (
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={removeAvatar}
                disabled={loading}
                className="w-full"
              >
                {loading ? "Removing..." : "Remove Picture"}
              </Button>
            )}
          </div>

          {error && (
            <Alert variant="destructive" className="w-full max-w-xs">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {uploadSuccess && (
            <Alert variant="default" className="w-full max-w-xs border-green-200 bg-green-50">
              <AlertTitle>Success!</AlertTitle>
              <AlertDescription>Avatar updated successfully!</AlertDescription>
            </Alert>
          )}

          {/* <p className="text-xs text-muted-foreground text-center max-w-md">
            Recommended: Square image • 800×800px or higher • JPG, PNG, WebP, GIF • Max 50MB
          </p> */}
        </CardContent>
      </GlassCard>

      {/* ==================== PERSONAL INFORMATION ==================== */}
      <GlassCard>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>Update your profile details for project visibility.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col items-center gap-4">
            <Avatar className="w-32 h-32 ring-2 ring-border">
              <AvatarImage src={profile.avatar_url || undefined} alt={profile.full_name} />
              <AvatarFallback className="text-4xl">{profile.full_name?.[0]}</AvatarFallback>
            </Avatar>
          </div>
          <div className="space-y-4">
            <div>
              <Label htmlFor="full_name">Full Name</Label>
              <Input name="full_name" value={profile.full_name} onChange={handleProfileChange} disabled={!editMode} />
            </div>
            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input name="email" value={profile.email} onChange={handleProfileChange} disabled />
            </div>
            <div>
              <Label htmlFor="phone">Phone Number</Label>
              <Input name="phone" value={profile.phone} onChange={handleProfileChange} disabled={!editMode} />
            </div>
            <div>
              <Label htmlFor="job_title">Job Title / Role</Label>
              <Input name="job_title" value={profile.job_title} onChange={handleProfileChange} disabled={!editMode} />
            </div>
          </div>
        </CardContent>
        <CardFooter className="justify-end gap-2">
          {editMode ? (
            <>
              <Button variant="outline" onClick={() => setEditMode(false)}>Cancel</Button>
              <Button onClick={handleProfileSave} disabled={loading}>
                {loading ? "Saving..." : "Save Changes"}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => setEditMode(true)}>Edit Profile</Button>
          )}
        </CardFooter>
      </GlassCard>

      {/* ==================== SECURITY SETTINGS ==================== */}
      <GlassCard>
        <CardHeader>
          <CardTitle>Security Settings</CardTitle>
          <CardDescription>Manage your account security.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {passwordSuccess && (
            <Alert variant="default" className="border-green-200 bg-green-50">
              <AlertTitle>Success!</AlertTitle>
              <AlertDescription>Your password has been changed successfully.</AlertDescription>
            </Alert>
          )}
          <Button variant="outline" onClick={() => setPasswordModal(true)}>
            Change Password
          </Button>
        </CardContent>
      </GlassCard>

      {/* ==================== ROLES & PERMISSIONS ==================== */}
      <GlassCard>
        <CardHeader>
          <CardTitle>Roles & Permissions</CardTitle>
          <CardDescription>Your current role and permissions in the system.</CardDescription>
        </CardHeader>
        <CardContent>
          {user && user.roles && user.roles.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {user.roles.map((role: any) => (
                <Badge key={role.role_name}>
                  {role.role_name.replace(/_/g, " ")}
                </Badge>
              ))}
            </div>
          ) : (
            <div className="text-muted-foreground">No roles assigned.</div>
          )}
        </CardContent>
      </GlassCard>

      {/* ==================== DATA & PRIVACY ==================== */}
      <GlassCard>
        <CardHeader>
          <CardTitle>Data & Privacy</CardTitle>
          <CardDescription>Control your data and privacy preferences.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline" onClick={() => setPrivacyModal(true)}>
            Download My Data
          </Button>
          <Button variant="destructive" onClick={() => setDeleteModal(true)}>
            Delete My Account
          </Button>
        </CardContent>
      </GlassCard>

      {/* ==================== CHANGE PASSWORD MODAL ==================== */}
      <AlertDialog open={passwordModal} onOpenChange={setPasswordModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change Password</AlertDialogTitle>
            <AlertDialogDescription>
              To update your password, please fill all fields below.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="old_password">Current Password</Label>
              <div className="relative">
                <Input
                  id="old_password"
                  type={showOldPassword ? "text" : "password"}
                  placeholder="Enter current password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  autoComplete="current-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowOldPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showOldPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label htmlFor="new_password">New Password</Label>
              <div className="relative">
                <Input
                  id="new_password"
                  type={showNewPassword ? "text" : "password"}
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label htmlFor="confirm_password">Confirm New Password</Label>
              <div className="relative">
                <Input
                  id="confirm_password"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setPasswordModal(false);
              setError("");
              setOldPassword("");
              setNewPassword("");
              setConfirmPassword("");
            }}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handlePasswordChange} disabled={loading}>
              Change
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ==================== CONFIRM PASSWORD CHANGE ==================== */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Password Change</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to change your password?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowConfirmDialog(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handlePasswordConfirm} disabled={loading}>
              {loading ? "Changing..." : "Yes, Change Password"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ==================== DOWNLOAD DATA MODAL ==================== */}
      <AlertDialog open={privacyModal} onOpenChange={setPrivacyModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Download My Data</AlertDialogTitle>
            <AlertDialogDescription>Your data will be prepared for download. (Feature coming soon)</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPrivacyModal(false)}>Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ==================== DELETE ACCOUNT MODAL ==================== */}
      <AlertDialog open={deleteModal} onOpenChange={setDeleteModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete My Account</AlertDialogTitle>
            <AlertDialogDescription>This action is irreversible. Are you sure?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteModal(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => setDeleteModal(false)}>
              Delete (Coming Soon)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SettingsPage;