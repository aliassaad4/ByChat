import { useState, useEffect } from "react";
import {
  Loader2, Save, Upload, Globe, Mail, MapPin, FileText, User, X, ArrowLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

interface Props {
  phoneNumberId: string;
  accessToken: string;
  onBack: () => void;
}

interface WaProfile {
  about: string;
  description: string;
  address: string;
  email: string;
  websites: string[];
  profile_picture_url: string;
  vertical: string;
}

const verticals = [
  "UNDEFINED", "OTHER", "AUTO", "BEAUTY", "APPAREL", "EDU", "ENTERTAIN",
  "EVENT_PLAN", "FINANCE", "GROCERY", "GOVT", "HOTEL", "HEALTH", "NONPROFIT",
  "PROF_SERVICES", "RETAIL", "TRAVEL", "RESTAURANT", "NOT_A_BIZ",
];

export function WhatsAppProfileSettings({ phoneNumberId, accessToken, onBack }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPic, setUploadingPic] = useState(false);

  const [about, setAbout] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [website1, setWebsite1] = useState("");
  const [website2, setWebsite2] = useState("");
  const [vertical, setVertical] = useState("OTHER");
  const [profilePicUrl, setProfilePicUrl] = useState("");

  useEffect(() => {
    fetchProfile();
  }, []);

  const PROXY = "https://epoqhtjaqmwqmapfrcwn.supabase.co/functions/v1/whatsapp-profile";

  async function fetchProfile() {
    setLoading(true);
    try {
      const res = await fetch(
        `${PROXY}?phone_number_id=${phoneNumberId}&token=${encodeURIComponent(accessToken)}`
      );
      const data = await res.json();
      if (data.data?.[0]) {
        const p = data.data[0];
        setAbout(p.about || "");
        setDescription(p.description || "");
        setAddress(p.address || "");
        setEmail(p.email || "");
        setVertical(p.vertical || "OTHER");
        setProfilePicUrl(p.profile_picture_url || "");
        if (p.websites?.length > 0) setWebsite1(p.websites[0]);
        if (p.websites?.length > 1) setWebsite2(p.websites[1]);
      }
    } catch (err) {
      console.error("Failed to fetch profile:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const websites: string[] = [];
      if (website1.trim()) websites.push(website1.trim());
      if (website2.trim()) websites.push(website2.trim());

      const body: any = {
        messaging_product: "whatsapp",
        about: about.substring(0, 139),
        description: description.substring(0, 512),
        address,
        email,
        websites,
        vertical,
      };

      const res = await fetch(PROXY, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number_id: phoneNumberId, token: accessToken, ...body }),
      });
      const data = await res.json();
      if (res.ok && !data.error) {
        toast.success("WhatsApp profile updated!");
      } else {
        toast.error(data.error?.message || data.error || "Failed to update profile");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleUploadPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }

    setUploadingPic(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("phone_number_id", phoneNumberId);
      formData.append("token", accessToken);

      const res = await fetch(PROXY, { method: "POST", body: formData });
      const data = await res.json();

      if (res.ok && data.success) {
        toast.success("Profile picture updated!");
        setTimeout(fetchProfile, 2000);
      } else {
        toast.error(data.error || "Failed to upload profile picture");
      }
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploadingPic(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#25D366]" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            WhatsApp Business Profile
          </h2>
          <p className="text-sm text-muted-foreground">Edit how your business appears on WhatsApp</p>
        </div>
      </div>

      {/* Profile Picture */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="w-4 h-4 text-muted-foreground" />
            Profile Picture
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-border">
              {profilePicUrl ? (
                <img src={profilePicUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User className="w-8 h-8 text-muted-foreground" />
              )}
            </div>
            <div>
              <label className="cursor-pointer">
                <Button variant="outline" size="sm" className="gap-1.5" asChild disabled={uploadingPic}>
                  <span>
                    {uploadingPic ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    {uploadingPic ? "Uploading..." : "Upload Photo"}
                  </span>
                </Button>
                <input type="file" accept="image/*" className="hidden" onChange={handleUploadPhoto} disabled={uploadingPic} />
              </label>
              <p className="text-xs text-muted-foreground mt-1">JPG or PNG, max 5MB. Square recommended.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* About & Description */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground" />
            About & Description
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>About <span className="text-muted-foreground text-xs">({about.length}/139)</span></Label>
            <Input
              value={about}
              onChange={(e) => setAbout(e.target.value.substring(0, 139))}
              placeholder="Short tagline for your business"
              maxLength={139}
            />
            <p className="text-xs text-muted-foreground">Shown under your business name on WhatsApp</p>
          </div>
          <div className="space-y-2">
            <Label>Description <span className="text-muted-foreground text-xs">({description.length}/512)</span></Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.substring(0, 512))}
              placeholder="Describe what your business does..."
              rows={3}
              maxLength={512}
            />
          </div>
          <div className="space-y-2">
            <Label>Business Category</Label>
            <select
              value={vertical}
              onChange={(e) => setVertical(e.target.value)}
              className="w-full h-10 rounded-md border border-border bg-muted/50 px-3 text-sm"
            >
              {verticals.map((v) => (
                <option key={v} value={v}>{v.replace(/_/g, " ")}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Contact Info */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="w-4 h-4 text-muted-foreground" />
            Contact Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Address</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Your business address" />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="business@example.com" />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" /> Website 1</Label>
              <Input value={website1} onChange={(e) => setWebsite1(e.target.value)} placeholder="https://yourstore.com" />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" /> Website 2</Label>
              <Input value={website2} onChange={(e) => setWebsite2(e.target.value)} placeholder="https://instagram.com/yourstore" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end pb-8">
        <Button onClick={handleSave} disabled={saving} size="lg" className="gap-2 bg-[#25D366] hover:bg-[#1da851] text-white">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Profile
        </Button>
      </div>
    </div>
  );
}
