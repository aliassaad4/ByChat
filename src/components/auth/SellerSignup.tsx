import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { cn } from "@/lib/utils";

import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { sellerSchema, type SellerFormData } from "./seller-signup/SellerSignupSchema";
import StepPersonalInfo from "./seller-signup/StepPersonalInfo";
import StepBusinessInfo from "./seller-signup/StepBusinessInfo";
import StepOperations from "./seller-signup/StepOperations";

interface SellerSignupProps {
  onSwitchToLogin: () => void;
}

const STEPS = ["Personal", "Business & AI", "Operations"];

const SellerSignup = ({ onSwitchToLogin }: SellerSignupProps) => {
  const [step, setStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const form = useForm<SellerFormData>({
    resolver: zodResolver(sellerSchema),
    defaultValues: {
      acceptsCash: true,
      acceptsCard: false,
      acceptsOmt: false,
      acceptsWhish: false,
      aiCapabilities: [],
    },
  });

  const onSubmit = async (data: SellerFormData) => {
    setIsLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: { emailRedirectTo: window.location.origin },
      });

      if (authError) throw authError;

      if (authData.user) {
        const { error: profileError } = await supabase.from("sellers").insert({
          user_id: authData.user.id,
          full_name: data.fullName,
          phone_number: data.phoneNumber,
          business_name: data.businessName,
          business_type: data.businessType,
          business_description: data.businessDescription,
          city_area: data.cityArea,
          business_address: data.businessAddress || null,
          working_hours_open: data.workingHoursOpen || null,
          working_hours_close: data.workingHoursClose || null,
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
        {/* Progress bar */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((label, i) => (
            <div key={label} className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                    i <= step
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {i + 1}
                </div>
                <span className={`text-xs hidden sm:block ${i <= step ? "text-foreground" : "text-muted-foreground"}`}>
                  {label}
                </span>
              </div>
              <div className={`h-1 rounded-full transition-all duration-500 ${
                i <= step ? "bg-primary" : "bg-muted"
              }`} />
            </div>
          ))}
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className={cn(step !== 0 && "hidden")}> 
            <StepPersonalInfo form={form} onNext={() => setStep(1)} />
          </div>
          <div className={cn(step !== 1 && "hidden")}>
            <StepBusinessInfo form={form} onNext={() => setStep(2)} onBack={() => setStep(0)} />
          </div>
          <div className={cn(step !== 2 && "hidden")}>
            <StepOperations form={form} onBack={() => setStep(1)} isLoading={isLoading} />
          </div>
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
