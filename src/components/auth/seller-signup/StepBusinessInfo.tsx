import { UseFormReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Store, ArrowLeft, ArrowRight, Bot, Check as CheckIcon } from "lucide-react";
import { BUSINESS_TYPES, LEBANESE_CITIES, AI_AGENT_CAPABILITIES, AI_TONE_OPTIONS } from "./SellerSignupSchema";
import type { SellerFormData } from "./SellerSignupSchema";

interface StepBusinessInfoProps {
  form: UseFormReturn<SellerFormData>;
  onNext: () => void;
  onBack: () => void;
}

const StepBusinessInfo = ({ form, onNext, onBack }: StepBusinessInfoProps) => {
  const { register, setValue, watch, formState: { errors }, trigger } = form;
  const aiCapabilities = watch("aiCapabilities") || [];

  const handleNext = async () => {
    const valid = await trigger(["businessName", "businessType", "businessDescription", "cityArea", "aiCapabilities", "aiTone"]);
    if (valid) onNext();
  };

  const toggleCapability = (value: string) => {
    const current = aiCapabilities;
    const updated = current.includes(value)
      ? current.filter((c) => c !== value)
      : [...current, value];
    setValue("aiCapabilities", updated, { shouldValidate: true });
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-secondary/20 to-secondary/5 flex items-center justify-center mx-auto mb-4">
          <Store className="w-7 h-7 text-secondary" />
        </div>
        <h2 className="text-2xl font-bold">Business & AI Setup</h2>
        <p className="text-muted-foreground text-sm mt-1">Tell us about your business and how you want your AI agent to work</p>
      </div>

      {/* Business Info */}
      <div>
        <h3 className="text-lg font-semibold mb-4 gradient-text">Business Details</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="businessName">Business Name</Label>
            <Input id="businessName" placeholder="Your Shop Name" {...register("businessName")} className="bg-muted/50 border-border" />
            {errors.businessName && <p className="text-destructive text-sm">{errors.businessName.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Business Type</Label>
            <Select onValueChange={(value: any) => setValue("businessType", value)}>
              <SelectTrigger className="bg-muted/50 border-border">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {BUSINESS_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.businessType && <p className="text-destructive text-sm">{errors.businessType.message}</p>}
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="businessDescription">Business Description</Label>
            <Textarea
              id="businessDescription"
              placeholder="Describe your business in detail — this helps the AI agent understand your brand, products, and how to assist your customers..."
              {...register("businessDescription")}
              className="bg-muted/50 border-border min-h-[100px]"
            />
            {errors.businessDescription && <p className="text-destructive text-sm">{errors.businessDescription.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>City / Area</Label>
            <Select onValueChange={(value) => setValue("cityArea", value)}>
              <SelectTrigger className="bg-muted/50 border-border">
                <SelectValue placeholder="Select your city" />
              </SelectTrigger>
              <SelectContent>
                {LEBANESE_CITIES.map((city) => (
                  <SelectItem key={city} value={city}>{city}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.cityArea && <p className="text-destructive text-sm">{errors.cityArea.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="businessAddress">Business Address <span className="text-muted-foreground text-xs">(Optional)</span></Label>
            <Input id="businessAddress" placeholder="Building, Street, Floor..." {...register("businessAddress")} className="bg-muted/50 border-border" />
          </div>
        </div>
      </div>

      {/* AI Agent Config */}
      <div>
        <h3 className="text-lg font-semibold mb-4 gradient-text flex items-center gap-2">
          <Bot className="w-5 h-5" /> AI Agent Preferences
        </h3>

        <div className="space-y-4">
          <div className="space-y-3">
            <Label>What should your AI agent do?</Label>
            <div className="grid sm:grid-cols-2 gap-3">
              {AI_AGENT_CAPABILITIES.map((cap) => (
                <div
                  key={cap.value}
                  onClick={() => toggleCapability(cap.value)}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-200 ${
                    aiCapabilities.includes(cap.value)
                      ? "border-primary/50 bg-primary/10"
                      : "border-border bg-muted/30 hover:border-muted-foreground/30"
                  }`}
                >
                  <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                    aiCapabilities.includes(cap.value) ? "bg-primary border-primary" : "border-muted-foreground/40"
                  }`}>
                    {aiCapabilities.includes(cap.value) && <CheckIcon className="w-3 h-3 text-primary-foreground" />}
                  </div>
                  <span className="text-sm">{cap.label}</span>
                </div>
              ))}
            </div>
            {errors.aiCapabilities && <p className="text-destructive text-sm">{errors.aiCapabilities.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>AI Agent Tone</Label>
            <Select onValueChange={(value) => setValue("aiTone", value, { shouldValidate: true })}>
              <SelectTrigger className="bg-muted/50 border-border">
                <SelectValue placeholder="How should the agent sound?" />
              </SelectTrigger>
              <SelectContent>
                {AI_TONE_OPTIONS.map((tone) => (
                  <SelectItem key={tone.value} value={tone.value}>{tone.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.aiTone && <p className="text-destructive text-sm">{errors.aiTone.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="aiCustomInstructions">Custom Instructions for AI <span className="text-muted-foreground text-xs">(Optional)</span></Label>
            <Textarea
              id="aiCustomInstructions"
              placeholder="E.g. 'Always greet customers in Arabic first', 'Mention our weekend deals', 'Don't offer discounts'..."
              {...register("aiCustomInstructions")}
              className="bg-muted/50 border-border min-h-[80px]"
            />
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <Button type="button" variant="ghost" onClick={onBack} className="flex-1">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <Button type="button" variant="hero" className="flex-1" onClick={handleNext}>
          Next <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
};

export default StepBusinessInfo;
