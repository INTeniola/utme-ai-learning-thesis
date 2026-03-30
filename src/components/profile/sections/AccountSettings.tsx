import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Check, X, Loader2, AlertCircle,Lock, LogOut, Save, Calendar, Target, User, Phone, Edit2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

const RESTRICTED_USERNAMES = [
  'admin', 'moderator', 'quizant', 'mentat', 'system', 'root', 'support',
  'fuck', 'shit', 'pussy', 'dick', 'asshole', 'bitch'
];

interface AccountSettingsProps {
  user: any;
  profile: any;
  onUpdate: () => void;
}

export function AccountSettings({ user, profile, onUpdate }: AccountSettingsProps) {
  const { signOut } = useAuth();
  const [username, setUsername] = useState(profile?.username || "");
  const [isChecking, setIsChecking] = useState(false);
  const [availability, setAvailability] = useState<'available' | 'taken' | 'invalid' | 'restricted' | null>(null);
  const [fullName, setFullName] = useState(profile?.fullName || "");
  const [phoneNumber, setPhoneNumber] = useState(profile?.phone_number || "");
  const [examDate, setExamDate] = useState(profile?.examDate ? format(profile.examDate, "yyyy-MM-dd") : "");
  const [targetScore, setTargetScore] = useState(profile?.targetScore || 300);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Security
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (!username || username === profile?.username) {
      setAvailability(null);
      return;
    }
    if (username.length < 3) { setAvailability('invalid'); return; }
    if (RESTRICTED_USERNAMES.some(v => username.toLowerCase().includes(v))) { setAvailability('restricted'); return; }

    const timer = setTimeout(async () => {
      setIsChecking(true);
      const { data, error } = await supabase.from('profiles').select('username').eq('username', username).maybeSingle();
      setIsChecking(false);
      if (error) console.error(error);
      setAvailability(data ? 'taken' : 'available');
    }, 500);
    return () => clearTimeout(timer);
  }, [username, profile?.username]);

  const handleUpdateProfile = async () => {
    if (!user) return;
    if (availability && availability !== 'available') {
      toast.error("Please choose a valid username");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          username: username || null,
          full_name: fullName,
          phone_number: phoneNumber || null,
          utme_exam_date: examDate || null,
          academic_goals: {
            targetScore,
            examDate: examDate || null,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;
      toast.success("Settings saved successfully");
      setIsEditing(false);
      onUpdate();
    } catch (error) {
      console.error(error);
      toast.error("Failed to update settings");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) { toast.error("Passwords do not match"); return; }
    if (newPassword.length < 8) { toast.error("Min 8 characters required"); return; }
    
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Password changed successfully");
      setPasswordDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setChangingPassword(false);
    }
  };

  const inputClass = cn(
    "h-12 font-bold transition-all w-full",
    isEditing 
      ? "rounded-2xl border-2 focus-visible:ring-primary px-3 bg-background" 
      : "border-transparent bg-transparent px-0 text-base shadow-none focus-visible:ring-0 cursor-default"
  );

  return (
    <div className="max-w-3xl space-y-10 pb-20">
      <div className="flex justify-between items-center bg-card p-6 rounded-[2rem] border shadow-sm">
        <div>
          <h2 className="text-2xl font-black tracking-tighter">Account & Settings</h2>
          <p className="text-sm text-muted-foreground">Manage your identity, goals, and security</p>
        </div>
        {!isEditing ? (
          <Button onClick={() => setIsEditing(true)} variant="outline" className="rounded-xl font-bold h-10 px-5 gap-2 border-primary/20 hover:bg-primary/5">
            <Edit2 className="h-4 w-4 text-primary" /> Edit Profile
          </Button>
        ) : (
          <Button onClick={() => setIsEditing(false)} variant="ghost" className="rounded-xl font-bold h-10 px-5 text-muted-foreground hover:text-foreground">
            Cancel Edit
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-1 gap-8">
        {/* Personal Info Area */}
        <section className="space-y-6">
          <div className="flex items-center gap-2 mb-2">
             <User className="h-4 w-4 text-primary" />
             <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Personal Information</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fullname" className="text-[10px] font-black uppercase tracking-widest ml-1 text-muted-foreground">Full Name</Label>
              <Input 
                id="fullname" 
                value={fullName} 
                onChange={(e) => setFullName(e.target.value)}
                readOnly={!isEditing}
                className={inputClass}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-end px-1">
                <Label htmlFor="username" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Username</Label>
                <div className="h-4 flex items-center">
                  {isChecking && isEditing && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                  {!isChecking && availability === 'available' && isEditing && <span className="text-[10px] font-black text-emerald-600 uppercase flex items-center gap-1"><Check className="h-3 w-3"/> OK</span>}
                </div>
              </div>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-black">@</span>
                <Input 
                  id="username" 
                  value={username} 
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  readOnly={!isEditing}
                  className={cn(inputClass, isEditing && "pl-10", isEditing && availability === 'available' && "border-emerald-500/30", isEditing && availability === 'taken' && "border-rose-500/30", !isEditing && "pl-8 text-foreground")}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-[10px] font-black uppercase tracking-widest ml-1 text-muted-foreground">Phone Number (Nigeria)</Label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="phone" 
                  placeholder="e.g. 0803 123 4567"
                  value={phoneNumber} 
                  onChange={(e) => {
                    let val = e.target.value;
                    // Auto-format for Nigerian numbers
                    if (val.startsWith('0') && val.length >= 11) {
                        val = '+234' + val.substring(1);
                    }
                    setPhoneNumber(val);
                  }}
                  className={cn(inputClass, isEditing && "pl-12", !isEditing && "pl-8")}
                  readOnly={!isEditing}
                />
              </div>
              <p className="text-[9px] text-muted-foreground ml-1">Formatted as +234... for international compatibility</p>
            </div>
          </div>
        </section>

        {/* Exam Goals Area */}
        <section className="space-y-6">
          <div className="flex items-center gap-2 mb-2">
             <Target className="h-4 w-4 text-primary" />
             <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Academic Goals</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="examDate" className="text-[10px] font-black uppercase tracking-widest ml-1 text-muted-foreground">UTME Exam Date</Label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="examDate" 
                  type="date"
                  value={examDate} 
                  onChange={(e) => setExamDate(e.target.value)}
                  className={cn(inputClass, isEditing && "pl-12", !isEditing && "pl-8")}
                  readOnly={!isEditing}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetScore" className="text-[10px] font-black uppercase tracking-widest ml-1 text-muted-foreground">Target Score (out of 400)</Label>
              <div className="relative">
                <Target className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="targetScore" 
                  type="number"
                  min={100} max={400}
                  value={targetScore} 
                  onChange={(e) => setTargetScore(Number(e.target.value))}
                  className={cn(inputClass, isEditing && "pl-12", !isEditing && "pl-8")}
                  readOnly={!isEditing}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Security Area */}
        <section className="space-y-6">
          <div className="flex items-center gap-2 mb-2">
             <Lock className="h-4 w-4 text-primary" />
             <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Security & Sessions</h3>
          </div>
          
          <Card className="rounded-[2rem] border-2">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-black tracking-tight">Account Password</p>
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-tighter">Updated 3 months ago</p>
                </div>
                <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="rounded-xl font-bold h-9">Update</Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-[2.5rem] p-8">
                    <DialogHeader>
                      <DialogTitle className="text-xl font-black tracking-tighter">Change Password</DialogTitle>
                      <DialogDescription>Choose a strong password with at least 8 characters.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                       <Input type="password" placeholder="New password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="h-12 rounded-2xl border-2" />
                       <Input type="password" placeholder="Confirm new password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="h-12 rounded-2xl border-2" />
                    </div>
                    <DialogFooter>
                       <Button onClick={handleChangePassword} disabled={changingPassword} className="w-full h-12 rounded-2xl font-black uppercase tracking-widest text-xs">
                         {changingPassword ? "Updating..." : "Save New Password"}
                       </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-black tracking-tight">Session Management</p>
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-tighter">Logged in on 2 devices</p>
                </div>
                <Button variant="ghost" className="text-rose-600 hover:text-rose-700 font-bold h-9" onClick={signOut}>Sign Out Everywhere</Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-border mt-8">
          {isEditing && (
            <Button 
              onClick={handleUpdateProfile} 
              disabled={saving || (availability !== null && availability !== 'available')}
              className="flex-1 h-14 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl flex items-center justify-center gap-2 transition-all hover:-translate-y-1 bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save All Changes
            </Button>
          )}

          <Button 
            variant="outline"
            onClick={signOut}
            className="h-14 rounded-2xl border-2 font-black uppercase tracking-widest text-[10px] px-8 border-rose-500/20 text-rose-500 hover:bg-rose-500/5 transition-all flex items-center justify-center gap-2"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Terminate Session
          </Button>
        </div>
      </div>
    </div>
  );
}
