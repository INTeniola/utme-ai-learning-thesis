import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { Check, Copy, Eye, EyeOff, Loader2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

// Password strength calculation helper
const getPasswordStrength = (password: string): {
    level: 'weak' | 'medium' | 'strong';
    percentage: number;
} => {
    if (!password) return { level: 'weak', percentage: 0 };
    let score = 0;
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^a-zA-Z0-9]/.test(password)) score += 1;
    
    if (score <= 2) return { level: 'weak', percentage: 33 };
    if (score <= 4) return { level: 'medium', percentage: 66 };
    return { level: 'strong', percentage: 100 };
};

export default function UpdatePassword() {
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const strength = getPasswordStrength(password);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) {
                toast.error("Invalid or expired password reset link.");
                navigate("/");
            }
        });
    }, [navigate]);

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password.length < 8) {
            toast.error('Password must be at least 8 characters long');
            return;
        }
        if (password !== confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }

        setLoading(true);
        try {
            const { error } = await supabase.auth.updateUser({
                password: password
            });

            if (error) throw error;
            toast.success("Password updated successfully!");
            navigate("/");
        } catch (error: any) {
            toast.error(error.message || "Failed to update password");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4 relative overflow-hidden">
            <div className="fixed inset-0 bg-[#0a0a0f]" />
            <div className="fixed top-[-20%] right-[-10%] h-[600px] w-[600px] rounded-full bg-primary/20 blur-[120px]" />
            <div className="fixed bottom-[-20%] left-[-10%] h-[600px] w-[600px] rounded-full bg-primary/10 blur-[120px]" />

            <Card className="w-full max-w-lg relative z-10 border-white/10 bg-card/40 backdrop-blur-xl shadow-2xl">
                <CardHeader className="space-y-1 text-center">
                    <CardTitle className="text-2xl font-bold tracking-tight">Set New Password</CardTitle>
                    <CardDescription>Enter a strong password for your account</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 sm:space-y-6">
                    <form onSubmit={handleUpdatePassword} className="space-y-4 sm:space-y-6">
                        <div className="space-y-2 text-left">
                            <Label htmlFor="password">New Password</Label>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    minLength={8}
                                    className="h-11 bg-background/50 border-white/10 focus:border-primary/50 pr-10"
                                />
                                <Button 
                                    type="button" 
                                    variant="ghost" 
                                    size="sm" 
                                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0" 
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                            </div>
                            
                            {password && (
                                <div className="space-y-1.5 pt-1">
                                    <div className="flex items-center gap-2">
                                        <Progress value={strength.percentage} className="h-1.5 flex-1" />
                                        <span className={`text-[10px] sm:text-xs font-medium ${strength.level === 'weak' ? 'text-destructive' : strength.level === 'medium' ? 'text-warning' : 'text-primary'}`}>
                                            {strength.level.charAt(0).toUpperCase() + strength.level.slice(1)}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="space-y-2 text-left">
                            <Label htmlFor="confirmPassword">Confirm Password</Label>
                            <Input
                                id="confirmPassword"
                                type={showPassword ? "text" : "password"}
                                placeholder="••••••••"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                minLength={8}
                                className="h-11 bg-background/50 border-white/10 focus:border-primary/50"
                            />
                        </div>

                        <div className="pt-2 space-y-3">
                            <Button
                                type="submit"
                                className="w-full gap-2 h-11 text-base font-semibold shadow-lg shadow-primary/20"
                                disabled={loading}
                            >
                                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                                {loading ? "Updating..." : "Update Password"}
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                className="w-full text-muted-foreground hover:text-foreground"
                                onClick={() => navigate("/")}
                                disabled={loading}
                            >
                                Back to login
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}

