import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;

interface LoginFormProps {
  onSwitchToSignup: () => void;
}

const LoginForm = ({ onSwitchToSignup }: LoginFormProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) throw error;

      // Ensure the session is set before querying profile tables
      await supabase.auth.getSession();

      // Check if user is a seller or buyer and redirect accordingly
      const { data: sellerProfile } = await supabase
        .from("sellers")
        .select("id")
        .eq("user_id", authData.user.id)
        .maybeSingle();

      const { data: buyerProfile } = await supabase
        .from("buyers")
        .select("id")
        .eq("user_id", authData.user.id)
        .maybeSingle();

      toast.success("Welcome back!");
      if (sellerProfile) {
        navigate("/seller");
      } else if (buyerProfile) {
        navigate("/buyer");
      } else {
        // No profile found — likely a new user whose profile wasn't created
        navigate("/auth");
        toast.error("No profile found. Please sign up first.");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to sign in");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="glass-card p-8">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mx-auto mb-4">
            <LogIn className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-2xl font-bold">Welcome Back</h2>
          <p className="text-muted-foreground text-sm mt-1">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="john@example.com"
              {...register("email")}
              className="bg-muted/50 border-border"
            />
            {errors.email && (
              <p className="text-destructive text-sm">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              {...register("password")}
              className="bg-muted/50 border-border"
            />
            {errors.password && (
              <p className="text-destructive text-sm">{errors.password.message}</p>
            )}
          </div>

          <Button type="submit" variant="hero" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign In"
            )}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Don't have an account?{" "}
          <button onClick={onSwitchToSignup} className="text-primary hover:underline font-medium">
            Sign up
          </button>
        </p>
      </div>
    </div>
  );
};

export default LoginForm;
