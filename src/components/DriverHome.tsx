import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Car,
  CheckCircle2,
  Fuel,
  MapPin,
  UserRound,
  Clock3,
  Route,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/use-me";
import { MarkAttendanceCard } from "@/components/MarkAttendanceCard";
import { useVehicleOptions, vehicleLabel } from "@/lib/vehicle-helpers";
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

type Trip = {
  id: string;
  trip_date: string;
  from_location: string;
  to_location: string;
  purpose: string;
  status: string;
  vehicle_id: string | null;
  vehicle_label: string;
};

type FuelEntry = {
  id: string;
  entry_date: string;
  vehicle_label: string;
  quantity: number | null;
  amount: number | null;
  odometer_km: number | null;
  expense_type: string | null;
};

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
      <header className="mb-3 flex items-center gap-2">
        <span className="text-primary">{icon}</span>
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
      </header>
      {children}
    </section>
  );
}

export function DriverHome() {
  const me = useMe();
  const qc = useQueryClient();
  const vehiclesQ = useVehicleOptions();
  const vehicleName = (id: string | null) => {
    if (!id) return "";
    const v = vehiclesQ.data?.find((x) => x.id === id);
    return v ? vehicleLabel(v) : "";
  };

  const leaderQ = useQuery({
    queryKey: ["driver-leader", me.id],
    enabled: !!me.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("candidates" as never)
        .select("reports_to")
        .eq("id", me.id!)
        .maybeSingle();
      const rid = (data as { reports_to?: string } | null)?.reports_to;
      if (!rid) return null;
      const { data: boss } = await supabase
        .from("candidates" as never)
        .select("full_name, mobile")
        .eq("id", rid)
        .maybeSingle();
      return (boss as { full_name: string; mobile: string } | null) ?? null;
    },
  });

  const tripsQ = useQuery({
    queryKey: ["driver-trips", me.id],
    enabled: !!me.id,
    queryFn: async (): Promise<Trip[]> => {
      const { data, error } = await supabase
        .from("driver_trips" as never)
        .select("id,trip_date,from_location,to_location,purpose,status,vehicle_id")
        .eq("driver_id", me.id!)
        .gte("trip_date", format(new Date(), "yyyy-MM-dd"))
        .order("trip_date", { ascending: true })
        .order("created_at", { ascending: true })
        .limit(20);
      if (error) throw error;
      return ((data as unknown) as Omit<Trip, "vehicle_label">[]).map((t) => ({
        ...t,
        vehicle_label: vehicleName(t.vehicle_id),
      }));
    },
  });

  const fuelQ = useQuery({
    queryKey: ["driver-fuel", me.id],
    enabled: !!me.id,
    queryFn: async (): Promise<FuelEntry[]> => {
      const { data, error } = await supabase
        .from("vehicle_fuel_entries" as never)
        .select("id,entry_date,vehicle_id,quantity,amount,odometer_km,expense_type,notes")
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      const rows = ((data as unknown) as Array<Record<string, unknown>>) ?? [];
      return rows
        .filter((r) => String(r.notes ?? "").includes(me.fullName))
        .slice(0, 10)
        .map((r) => ({
          id: String(r.id),
          entry_date: String(r.entry_date),
          vehicle_label: vehicleName((r.vehicle_id as string) ?? null),
          quantity: r.quantity == null ? null : Number(r.quantity),
          amount: r.amount == null ? null : Number(r.amount),
          odometer_km: r.odometer_km == null ? null : Number(r.odometer_km),
          expense_type: (r.expense_type as string) ?? null,
        }));
    },
  });

  const ackTrip = useMutation({
    mutationFn: async (tripId: string) => {
      const { error } = await supabase
        .from("driver_trips" as never)
        .update({ status: "acknowledged", acknowledged_at: new Date().toISOString() } as never)
        .eq("id", tripId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Trip acknowledged");
      qc.invalidateQueries({ queryKey: ["driver-trips", me.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not acknowledge"),
  });

  const completeTrip = useMutation({
    mutationFn: async (tripId: string) => {
      const { error } = await supabase
        .from("driver_trips" as never)
        .update({ status: "completed", completed_at: new Date().toISOString() } as never)
        .eq("id", tripId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Trip completed");
      qc.invalidateQueries({ queryKey: ["driver-trips", me.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update"),
  });

  // Fuel / expense form
  const [vehicleId, setVehicleId] = useState("");
  const [expenseType, setExpenseType] = useState("fuel");
  const [quantity, setQuantity] = useState("");
  const [amount, setAmount] = useState("");
  const [odometer, setOdometer] = useState("");
  const [place, setPlace] = useState("");

  const saveFuel = useMutation({
    mutationFn: async () => {
      if (!vehicleId) throw new Error("Choose the vehicle");
      if (!amount || Number(amount) <= 0) throw new Error("Enter the amount");
      const qty = quantity ? Number(quantity) : null;
      const amt = Number(amount);
      const { error } = await supabase.from("vehicle_fuel_entries" as never).insert({
        vehicle_id: vehicleId,
        entry_date: format(new Date(), "yyyy-MM-dd"),
        entry_time: format(new Date(), "HH:mm:ss"),
        expense_type: expenseType,
        fuel_type: expenseType === "fuel" ? "diesel" : null,
        quantity: qty,
        rate: qty && qty > 0 ? Math.round((amt / qty) * 100) / 100 : null,
        amount: amt,
        odometer_km: odometer ? Number(odometer) : null,
        location_text: place || null,
        payment_mode: "cash",
        notes: `By ${me.fullName} (driver app)`,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Expense saved");
      setQuantity(""); setAmount(""); setOdometer(""); setPlace("");
      qc.invalidateQueries({ queryKey: ["driver-fuel", me.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });

  const trips = tripsQ.data ?? [];
  const pending = useMemo(() => trips.filter((t) => t.status === "pending"), [trips]);

  // A vehicle is "theirs" only while a trip assigns it — pending or
  // acknowledged, today or upcoming. Drivers never see the full fleet.
  const assignedVehicles = useMemo(() => {
    const ids = new Set(
      trips
        .filter((t) => (t.status === "pending" || t.status === "acknowledged") && t.vehicle_id)
        .map((t) => t.vehicle_id as string),
    );
    return (vehiclesQ.data ?? []).filter((v) => ids.has(v.id));
  }, [trips, vehiclesQ.data]);

  // Auto-select when exactly one vehicle is currently assigned.
  if (!vehicleId && assignedVehicles.length === 1) setVehicleId(assignedVehicles[0].id);

  return (
    <div className="mx-auto w-full max-w-xl space-y-4 pb-8">
      <header className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Car className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold">{me.fullName || "Driver"}</p>
            <p className="text-xs text-muted-foreground">{me.designation || "Driver"} · Transport</p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          <UserRound className="h-3.5 w-3.5" />
          {leaderQ.data ? (
            <span>
              Reporting to <span className="font-medium text-foreground">{leaderQ.data.full_name}</span>
              {leaderQ.data.mobile ? ` · ${leaderQ.data.mobile}` : ""}
            </span>
          ) : (
            <span>Reporting to Transport Head</span>
          )}
        </div>
      </header>

      <MarkAttendanceCard candidateId={me.id} compact />

      <Card title={`My trips${pending.length ? ` (${pending.length} new)` : ""}`} icon={<Route className="h-4 w-4" />}>
        {tripsQ.isLoading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : trips.length === 0 ? (
          <p className="text-xs text-muted-foreground">No trips assigned yet. You'll get a notification when one is assigned.</p>
        ) : (
          <ul className="space-y-2">
            {trips.map((t) => (
              <li key={t.id} className="rounded-xl border border-border/50 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1 text-sm font-medium">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="truncate">{t.from_location || "Office"} → {t.to_location || "Destination"}</span>
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock3 className="h-3 w-3" />
                      {format(new Date(`${t.trip_date}T00:00:00`), "dd MMM yyyy")}
                      {t.vehicle_label ? ` · ${t.vehicle_label}` : ""}
                    </p>
                    {t.purpose ? <p className="mt-0.5 text-xs text-muted-foreground">{t.purpose}</p> : null}
                  </div>
                  {t.status === "pending" ? (
                    <Button size="sm" onClick={() => ackTrip.mutate(t.id)} disabled={ackTrip.isPending}>
                      Acknowledge
                    </Button>
                  ) : t.status === "acknowledged" ? (
                    <Button size="sm" variant="outline" onClick={() => completeTrip.mutate(t.id)} disabled={completeTrip.isPending}>
                      Complete
                    </Button>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" /> {t.status}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Add fuel / expense" icon={<Fuel className="h-4 w-4" />}>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label className="text-xs">Vehicle</Label>
            {assignedVehicles.length === 0 ? (
              <p className="mt-1 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                No vehicle assigned to you right now. When a trip with a vehicle is assigned, it will appear here.
              </p>
            ) : (
              <Select value={vehicleId} onValueChange={setVehicleId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Choose vehicle" /></SelectTrigger>
                <SelectContent>
                  {assignedVehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{vehicleLabel(v)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div>
            <Label className="text-xs">Type</Label>
            <Select value={expenseType} onValueChange={setExpenseType}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fuel">Fuel</SelectItem>
                <SelectItem value="toll">Toll</SelectItem>
                <SelectItem value="parking">Parking</SelectItem>
                <SelectItem value="repair">Repair</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Amount (₹)</Label>
            <Input className="mt-1" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
          </div>
          {expenseType === "fuel" && (
            <div>
              <Label className="text-xs">Litres</Label>
              <Input className="mt-1" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" />
            </div>
          )}
          <div>
            <Label className="text-xs">Odometer (km)</Label>
            <Input className="mt-1" inputMode="numeric" value={odometer} onChange={(e) => setOdometer(e.target.value)} placeholder="Optional" />
          </div>
          <div className="col-span-2">
            <Label className="text-xs">Place</Label>
            <Input className="mt-1" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Pump / location" />
          </div>
        </div>
        <Button className="mt-3 w-full" onClick={() => saveFuel.mutate()} disabled={saveFuel.isPending || assignedVehicles.length === 0}>
          {saveFuel.isPending ? "Saving…" : "Save expense"}
        </Button>
      </Card>

      <Card title="My recent entries" icon={<Clock3 className="h-4 w-4" />}>
        {fuelQ.isLoading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : (fuelQ.data ?? []).length === 0 ? (
          <p className="text-xs text-muted-foreground">No entries yet.</p>
        ) : (
          <ul className="divide-y divide-border/50 text-sm">
            {(fuelQ.data ?? []).map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{f.vehicle_label || "Vehicle"}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(`${f.entry_date}T00:00:00`), "dd MMM")}
                    {f.expense_type ? ` · ${f.expense_type}` : ""}
                    {f.quantity ? ` · ${f.quantity} L` : ""}
                    {f.odometer_km ? ` · ${f.odometer_km} km` : ""}
                  </p>
                </div>
                <span className="shrink-0 font-semibold">₹{f.amount ?? 0}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
