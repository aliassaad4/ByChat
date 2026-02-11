import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { Loader2, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const LEBANESE_CITIES = [
  "Beirut",
  "Tripoli",
  "Sidon",
  "Tyre",
  "Jounieh",
  "Byblos",
  "Baalbek",
  "Zahle",
  "Aley",
  "Batroun",
  "Beit Mery",
  "Broummana",
  "Nabatieh",
  "Baabda",
  "Jal el Dib",
  "Antelias",
  "Dbayeh",
  "Hazmieh",
  "Other",
];

const buyerSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  phoneNumber: z.string().min(8, "Invalid phone number"),
  cityArea: z.string().min(1, "Please select a city"),
  deliveryAddress: z.string().min(10, "Please enter your full delivery address"),
  preferredLanguage: z.enum(["en", "ar"]),
});

type BuyerFormData = z.infer<typeof buyerSchema>;

interface BuyerSignupProps {
  onSwitchToLogin: () => void;
}

const BuyerSignup = ({ onSwitchToLogin }: BuyerSignupProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<BuyerFormData>({
    resolver: zodResolver(buyerSchema),
    defaultValues: {
      preferredLanguage: "en",
    },
  });

  const onSubmit = async (data: BuyerFormData) => {
    setIsLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });

      if (authError) throw authError;

      if (authData.user) {
        const { error: profileError } = await supabase.from("buyers").insert({
          user_id: authData.user.id,
          full_name: data.fullName,
          phone_number: data.phoneNumber,
          city_area: data.cityArea,
          delivery_address: data.deliveryAddress,
          preferred_language: data.preferredLanguage,
        });

        if (profileError) throw profileError;

        toast.success("Account created successfully!");
        navigate("/buyer");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to create account");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="glass-card p-8">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto mb-4">
            <ShoppingBag className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-2xl font-bold">Create Buyer Account</h2>
          <p className="text-muted-foreground text-sm mt-1">Start shopping through conversation</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              placeholder="John Doe"
              {...register("fullName")}
              className="bg-muted/50 border-border"
            />
            {errors.fullName && (
              <p className="text-destructive text-sm">{errors.fullName.message}</p>
            )}
          </div>

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

          <div className="space-y-2">
            <Label htmlFor="phoneNumber">Phone Number</Label>
            <Input
              id="phoneNumber"
              placeholder="+961 XX XXX XXX"
              {...register("phoneNumber")}
              className="bg-muted/50 border-border"
            />
            {errors.phoneNumber && (
              <p className="text-destructive text-sm">{errors.phoneNumber.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>City / Area</Label>
            <Select onValueChange={(value) => setValue("cityArea", value)}>
              <SelectTrigger className="bg-muted/50 border-border">
                <SelectValue placeholder="Select your city" />
              </SelectTrigger>
              <SelectContent>
                {LEBANESE_CITIES.map((city) => (
                  <SelectItem key={city} value={city}>
                    {city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.cityArea && (
              <p className="text-destructive text-sm">{errors.cityArea.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="deliveryAddress">Delivery Address</Label>
            <Input
              id="deliveryAddress"
              placeholder="Building, Street, Floor, Landmark..."
              {...register("deliveryAddress")}
              className="bg-muted/50 border-border"
            />
            {errors.deliveryAddress && (
              <p className="text-destructive text-sm">{errors.deliveryAddress.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Preferred Language</Label>
            <Select
              defaultValue="en"
              onValueChange={(value: "en" | "ar") => setValue("preferredLanguage", value)}
            >
              <SelectTrigger className="bg-muted/50 border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="ar">العربية (Arabic)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" variant="hero" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating account...
              </>
            ) : (
              "Create Account"
            )}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Already have an account?{" "}
          <button onClick={onSwitchToLogin} className="text-primary hover:underline font-medium">
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
};

export default BuyerSignup;
