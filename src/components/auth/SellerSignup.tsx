import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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

const BUSINESS_TYPES = [
  { value: "restaurant", label: "Restaurant" },
  { value: "grocery", label: "Grocery" },
  { value: "clothing", label: "Clothing" },
  { value: "electronics", label: "Electronics" },
  { value: "beauty", label: "Beauty" },
  { value: "services", label: "Services" },
  { value: "other", label: "Other" },
];

const DELIVERY_OPTIONS = [
  { value: "pickup", label: "Pickup Only" },
  { value: "delivery", label: "Delivery Only" },
  { value: "both", label: "Both Pickup & Delivery" },
];

const sellerSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  phoneNumber: z.string().min(8, "Invalid phone number"),
  businessName: z.string().min(2, "Business name is required"),
  businessType: z.enum(["restaurant", "grocery", "clothing", "electronics", "beauty", "services", "other"]),
  businessDescription: z.string().optional(),
  cityArea: z.string().min(1, "Please select a city"),
  businessAddress: z.string().min(10, "Please enter your full business address"),
  workingHoursOpen: z.string().min(1, "Opening time is required"),
  workingHoursClose: z.string().min(1, "Closing time is required"),
  deliveryOption: z.enum(["pickup", "delivery", "both"]),
  acceptsCash: z.boolean(),
  acceptsCard: z.boolean(),
  acceptsOmt: z.boolean(),
  acceptsWhish: z.boolean(),
  whatsappNumber: z.string().min(8, "WhatsApp number is required"),
  instagramHandle: z.string().optional(),
});

type SellerFormData = z.infer<typeof sellerSchema>;

interface SellerSignupProps {
  onSwitchToLogin: () => void;
}

const SellerSignup = ({ onSwitchToLogin }: SellerSignupProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SellerFormData>({
    resolver: zodResolver(sellerSchema),
    defaultValues: {
      acceptsCash: true,
      acceptsCard: false,
      acceptsOmt: false,
      acceptsWhish: false,
    },
  });

  const onSubmit = async (data: SellerFormData) => {
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
        const { error: profileError } = await supabase.from("sellers").insert({
          user_id: authData.user.id,
          full_name: data.fullName,
          phone_number: data.phoneNumber,
          business_name: data.businessName,
          business_type: data.businessType,
          business_description: data.businessDescription || null,
          city_area: data.cityArea,
          business_address: data.businessAddress,
          working_hours_open: data.workingHoursOpen,
          working_hours_close: data.workingHoursClose,
          delivery_option: data.deliveryOption,
          accepts_cash: data.acceptsCash,
          accepts_card: data.acceptsCard,
          accepts_omt: data.acceptsOmt,
          accepts_whish: data.acceptsWhish,
          whatsapp_number: data.whatsappNumber,
          instagram_handle: data.instagramHandle || null,
        });

        if (profileError) throw profileError;

        toast.success("Account created successfully!");
        navigate("/seller");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to create account");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="glass-card p-8">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-secondary/20 to-secondary/5 flex items-center justify-center mx-auto mb-4">
            <Store className="w-7 h-7 text-secondary" />
          </div>
          <h2 className="text-2xl font-bold">Create Seller Account</h2>
          <p className="text-muted-foreground text-sm mt-1">Set up your shop and start selling</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Personal Info */}
          <div>
            <h3 className="text-lg font-semibold mb-4 gradient-text">Personal Information</h3>
            <div className="grid sm:grid-cols-2 gap-4">
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
            </div>
          </div>

          {/* Business Info */}
          <div>
            <h3 className="text-lg font-semibold mb-4 gradient-text">Business Information</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="businessName">Business Name</Label>
                <Input
                  id="businessName"
                  placeholder="Your Shop Name"
                  {...register("businessName")}
                  className="bg-muted/50 border-border"
                />
                {errors.businessName && (
                  <p className="text-destructive text-sm">{errors.businessName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Business Type</Label>
                <Select onValueChange={(value: any) => setValue("businessType", value)}>
                  <SelectTrigger className="bg-muted/50 border-border">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {BUSINESS_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.businessType && (
                  <p className="text-destructive text-sm">{errors.businessType.message}</p>
                )}
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="businessDescription">Business Description (Optional)</Label>
                <Textarea
                  id="businessDescription"
                  placeholder="Tell customers about your business..."
                  {...register("businessDescription")}
                  className="bg-muted/50 border-border min-h-[80px]"
                />
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
                <Label htmlFor="businessAddress">Business Address</Label>
                <Input
                  id="businessAddress"
                  placeholder="Building, Street, Floor..."
                  {...register("businessAddress")}
                  className="bg-muted/50 border-border"
                />
                {errors.businessAddress && (
                  <p className="text-destructive text-sm">{errors.businessAddress.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Operations */}
          <div>
            <h3 className="text-lg font-semibold mb-4 gradient-text">Operations</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="workingHoursOpen">Opening Time</Label>
                <Input
                  id="workingHoursOpen"
                  type="time"
                  {...register("workingHoursOpen")}
                  className="bg-muted/50 border-border"
                />
                {errors.workingHoursOpen && (
                  <p className="text-destructive text-sm">{errors.workingHoursOpen.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="workingHoursClose">Closing Time</Label>
                <Input
                  id="workingHoursClose"
                  type="time"
                  {...register("workingHoursClose")}
                  className="bg-muted/50 border-border"
                />
                {errors.workingHoursClose && (
                  <p className="text-destructive text-sm">{errors.workingHoursClose.message}</p>
                )}
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label>Delivery Options</Label>
                <Select onValueChange={(value: any) => setValue("deliveryOption", value)}>
                  <SelectTrigger className="bg-muted/50 border-border">
                    <SelectValue placeholder="Select delivery option" />
                  </SelectTrigger>
                  <SelectContent>
                    {DELIVERY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.deliveryOption && (
                  <p className="text-destructive text-sm">{errors.deliveryOption.message}</p>
                )}
              </div>

              <div className="space-y-4 sm:col-span-2">
                <Label>Accepted Payment Methods</Label>
                <div className="flex flex-wrap gap-6">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="cash"
                      defaultChecked
                      onCheckedChange={(checked) => setValue("acceptsCash", !!checked)}
                    />
                    <label htmlFor="cash" className="text-sm cursor-pointer">Cash</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="card"
                      onCheckedChange={(checked) => setValue("acceptsCard", !!checked)}
                    />
                    <label htmlFor="card" className="text-sm cursor-pointer">Card</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="omt"
                      onCheckedChange={(checked) => setValue("acceptsOmt", !!checked)}
                    />
                    <label htmlFor="omt" className="text-sm cursor-pointer">OMT</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="whish"
                      onCheckedChange={(checked) => setValue("acceptsWhish", !!checked)}
                    />
                    <label htmlFor="whish" className="text-sm cursor-pointer">Whish</label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-lg font-semibold mb-4 gradient-text">Contact & Social</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="whatsappNumber">WhatsApp Business Number</Label>
                <Input
                  id="whatsappNumber"
                  placeholder="+961 XX XXX XXX"
                  {...register("whatsappNumber")}
                  className="bg-muted/50 border-border"
                />
                {errors.whatsappNumber && (
                  <p className="text-destructive text-sm">{errors.whatsappNumber.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="instagramHandle">Instagram Handle (Optional)</Label>
                <Input
                  id="instagramHandle"
                  placeholder="@yourshop"
                  {...register("instagramHandle")}
                  className="bg-muted/50 border-border"
                />
              </div>
            </div>
          </div>

          <Button type="submit" variant="hero" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating account...
              </>
            ) : (
              "Create Seller Account"
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

export default SellerSignup;
