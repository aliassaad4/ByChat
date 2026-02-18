import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { User, Save, Loader2, Pencil, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const LEBANESE_CITIES = [
  "Beirut", "Tripoli", "Sidon", "Tyre", "Jounieh", "Byblos", "Baalbek",
  "Zahle", "Aley", "Batroun", "Beit Mery", "Broummana", "Nabatieh",
  "Baabda", "Jal el Dib", "Antelias", "Dbayeh", "Hazmieh", "Other",
];

function LocationPicker({ value, onChange, editing }: { value: string; onChange: (v: string) => void; editing: boolean }) {
  const [loading, setLoading] = useState(false);

  const getLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = `${pos.coords.latitude.toFixed(6)},${pos.coords.longitude.toFixed(6)}`;
        onChange(loc);
        setLoading(false);
        toast.success("Location captured!");
      },
      (err) => {
        toast.error("Could not get location: " + err.message);
        setLoading(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const hasCoords = value && /^-?\d+\.\d+,-?\d+\.\d+$/.test(value);

  if (!editing) {
    return hasCoords ? (
      <div className="flex items-center gap-2">
        <MapPin className="w-4 h-4 text-primary" />
        <a
          href={`https://www.google.com/maps?q=${value}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary hover:underline"
        >
          View on map
        </a>
      </div>
    ) : (
      <p className="text-sm text-muted-foreground">Not set</p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          placeholder="lat,lng or use button →"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1"
        />
        <Button type="button" variant="outline" size="icon" onClick={getLocation} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
        </Button>
      </div>
      {hasCoords && (
        <p className="text-xs text-muted-foreground">
          📍 Location set — <a href={`https://www.google.com/maps?q=${value}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">preview</a>
        </p>
      )}
    </div>
  );
}

export default function BuyerProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    phone_number: "",
    city_area: "",
    delivery_address: "",
    preferred_language: "en",
    location_coords: "",
  });

  const { data: buyer, isLoading } = useQuery({
    queryKey: ["buyer-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("buyers")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (buyer) {
      setForm({
        full_name: buyer.full_name,
        phone_number: buyer.phone_number,
        city_area: buyer.city_area,
        delivery_address: buyer.delivery_address,
        preferred_language: buyer.preferred_language,
        location_coords: (buyer as any).location_coords || "",
      });
    }
  }, [buyer]);

  const updateProfile = useMutation({
    mutationFn: async () => {
      if (!buyer) throw new Error("No profile");
      const { error } = await supabase
        .from("buyers")
        .update(form)
        .eq("id", buyer.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["buyer-profile"] });
      setEditing(false);
      toast.success("Profile updated!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!buyer) {
    return (
      <div className="text-center py-16">
        <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2">No profile found</h3>
        <p className="text-muted-foreground">Please complete your buyer signup first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Profile</h1>
        {!editing && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="w-4 h-4 mr-2" /> Edit
          </Button>
        )}
      </div>

      <Card className="glass-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="w-5 h-5 text-primary" />
            Your Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Email (read-only) */}
          <div className="space-y-1">
            <Label className="text-muted-foreground text-xs">Email</Label>
            <p className="text-sm">{user?.email}</p>
          </div>

          <Separator />

          {/* Full Name */}
          <div className="space-y-1.5">
            <Label>Full Name</Label>
            {editing ? (
              <Input
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
              />
            ) : (
              <p className="text-sm">{buyer.full_name}</p>
            )}
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <Label>Phone Number</Label>
            {editing ? (
              <Input
                value={form.phone_number}
                onChange={(e) => setForm((f) => ({ ...f, phone_number: e.target.value }))}
              />
            ) : (
              <p className="text-sm">{buyer.phone_number}</p>
            )}
          </div>

          {/* City */}
          <div className="space-y-1.5">
            <Label>City / Area</Label>
            {editing ? (
              <Select
                value={form.city_area}
                onValueChange={(v) => setForm((f) => ({ ...f, city_area: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEBANESE_CITIES.map((city) => (
                    <SelectItem key={city} value={city}>{city}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm">{buyer.city_area}</p>
            )}
          </div>

          {/* Delivery Address */}
          <div className="space-y-1.5">
            <Label>Delivery Address</Label>
            {editing ? (
              <Input
                value={form.delivery_address}
                onChange={(e) => setForm((f) => ({ ...f, delivery_address: e.target.value }))}
              />
            ) : (
              <p className="text-sm">{buyer.delivery_address}</p>
            )}
          </div>

          {/* Location */}
          <div className="space-y-1.5">
            <Label>📍 Location</Label>
            <LocationPicker
              value={form.location_coords}
              onChange={(v) => setForm((f) => ({ ...f, location_coords: v }))}
              editing={editing}
            />
          </div>

          {/* Language */}
          <div className="space-y-1.5">
            <Label>Preferred Language</Label>
            {editing ? (
              <Select
                value={form.preferred_language}
                onValueChange={(v) => setForm((f) => ({ ...f, preferred_language: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ar">العربية (Arabic)</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm">{buyer.preferred_language === "ar" ? "العربية (Arabic)" : "English"}</p>
            )}
          </div>

          {editing && (
            <div className="flex gap-2 pt-2">
              <Button
                variant="hero"
                onClick={() => updateProfile.mutate()}
                disabled={updateProfile.isPending}
                className="flex-1"
              >
                {updateProfile.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save Changes
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setEditing(false);
                  if (buyer) {
                    setForm({
                      full_name: buyer.full_name,
                      phone_number: buyer.phone_number,
                      city_area: buyer.city_area,
                      delivery_address: buyer.delivery_address,
                      preferred_language: buyer.preferred_language,
                      location_coords: (buyer as any).location_coords || "",
                    });
                  }
                }}
              >
                Cancel
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
