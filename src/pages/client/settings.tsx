import React, { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from "@/components/ui/card";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { getCurrentUser, updateProfile, updatePassword } from "@/lib/auth";


const SettingsPage = () => {
	const [user, setUser] = useState(null);
	const [editMode, setEditMode] = useState(false);
	const [profile, setProfile] = useState({
		full_name: "",
		avatar_url: "",
		email: "",
		phone: "",
		job_title: "",
	});
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

	useEffect(() => {
		getCurrentUser().then((u) => {
			if (u) {
				setUser(u);
				setProfile({
					full_name: u.profile.full_name,
					avatar_url: u.profile.avatar_url,
					email: u.email,
					phone: u.profile.phone || "",
					job_title: u.profile.job_title || "",
				});
			}
		});
	}, []);

	const handleProfileChange = (e) => {
		setProfile({ ...profile, [e.target.name]: e.target.value });
	};

	const handleProfileSave = async () => {
		setLoading(true);
		setError("");
		try {
			// Clean up payload: convert empty strings to null for optional fields
			const updates = {
				full_name: profile.full_name,
				avatar_url: profile.avatar_url || null,
				phone: profile.phone.trim() || null,
				job_title: profile.job_title.trim() || null,
			};
			await updateProfile(user.id, updates);
			// Refresh user profile after update
			const refreshedUser = await getCurrentUser();
			if (refreshedUser) {
				setUser(refreshedUser);
				setProfile({
					full_name: refreshedUser.profile.full_name,
					avatar_url: refreshedUser.profile.avatar_url,
					email: refreshedUser.email,
					phone: refreshedUser.profile.phone || "",
					job_title: refreshedUser.profile.job_title || "",
				});
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
		setShowConfirmDialog(true);
	};

  const handlePasswordConfirm = async () => {
		setLoading(true);
		setError("");
		try {
			// Securely verify current password by re-authenticating
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

	// --- UI Segmentation ---
	return (
		<div className="max-w-3xl mx-auto py-10 space-y-8">
			{/* Personal Info Section */}
			<GlassCard>
				<CardHeader>
					<CardTitle>Personal Information</CardTitle>
					<CardDescription>Update your profile details for project visibility.</CardDescription>
				</CardHeader>
				<CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
					<div className="flex flex-col items-center gap-4">
						<Avatar>
							<AvatarImage src={profile.avatar_url || undefined} alt={profile.full_name} />
							<AvatarFallback>{profile.full_name?.[0]}</AvatarFallback>
						</Avatar>
						{/* Avatar upload can be added here */}
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
						<Button onClick={handleProfileSave} disabled={loading}>Save</Button>
					) : (
						<Button variant="outline" onClick={() => setEditMode(true)}>Edit</Button>
					)}
				</CardFooter>
				{error && <Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
			</GlassCard>

			{/* Security Settings Section */}
			<GlassCard>
				<CardHeader>
					<CardTitle>Security Settings</CardTitle>
					<CardDescription>Manage your account security.</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<Button variant="outline" onClick={() => setPasswordModal(true)}>Change Password</Button>
					{/* <div className="flex items-center gap-2">
						<Label>Two-Factor Authentication (2FA)</Label>
						<Badge variant="secondary">Coming Soon</Badge>
					</div> */}
					{/* <div>
						<Label>Connected Devices / Active Sessions</Label>
						<div className="text-xs text-muted-foreground">Session management coming soon.</div>
					</div> */}
				</CardContent>
			</GlassCard>

			{/* Roles & Permissions Section */}
			<GlassCard>
				<CardHeader>
					<CardTitle>Roles & Permissions</CardTitle>
					<CardDescription>Your current role and permissions in the system.</CardDescription>
				</CardHeader>
				<CardContent>
					{user && user.roles.length > 0 ? (
						<div className="flex flex-wrap gap-2">
							{user.roles.map((role) => (
								<Badge key={role.role_name}>{role.role_name.replace(/_/g, " ")}</Badge>
							))}
						</div>
					) : (
						<div className="text-muted-foreground">No roles assigned.</div>
					)}
				</CardContent>
			</GlassCard>

			{/* Data & Privacy Section */}
			<GlassCard>
				<CardHeader>
					<CardTitle>Data & Privacy</CardTitle>
					<CardDescription>Control your data and privacy preferences.</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<Button variant="outline" onClick={() => setPrivacyModal(true)}>Download My Data</Button>
					<Button variant="destructive" onClick={() => setDeleteModal(true)}>Delete My Account</Button>
					<div>
						<Label>Privacy Settings</Label>
						<div className="text-xs text-muted-foreground">Data sharing preferences coming soon.</div>
					</div>
				</CardContent>
			</GlassCard>

			{/* Change Password Modal */}
			<AlertDialog open={passwordModal} onOpenChange={setPasswordModal}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Change Password</AlertDialogTitle>
						<AlertDialogDescription>To update your password, please fill all fields below.</AlertDialogDescription>
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
									onChange={e => setOldPassword(e.target.value)}
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
									onChange={e => setNewPassword(e.target.value)}
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
									onChange={e => setConfirmPassword(e.target.value)}
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
						{error && <Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
					</div>
					<AlertDialogFooter>
						<AlertDialogCancel onClick={() => setPasswordModal(false)}>Cancel</AlertDialogCancel>
						<AlertDialogAction onClick={handlePasswordChange} disabled={loading}>Change</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* Confirm Password Change Dialog */}
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
						<AlertDialogAction onClick={handlePasswordConfirm} disabled={loading}>Yes, Change Password</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* Password Success Message */}
			{passwordSuccess && (
				<div className="fixed top-6 left-1/2 -translate-x-1/2 z-50">
					<Alert variant="default">
						<AlertTitle>Password Updated</AlertTitle>
						<AlertDescription>Your password has been changed successfully.</AlertDescription>
					</Alert>
				</div>
			)}

			{/* Download Data Modal */}
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

			{/* Delete Account Modal */}
			<AlertDialog open={deleteModal} onOpenChange={setDeleteModal}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete My Account</AlertDialogTitle>
						<AlertDialogDescription>This action is irreversible. Are you sure?</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel onClick={() => setDeleteModal(false)}>Cancel</AlertDialogCancel>
						<AlertDialogAction variant="destructive" onClick={() => setDeleteModal(false)}>Delete (Coming Soon)</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
};

export default SettingsPage;
