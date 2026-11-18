export type VehicleInventoryFilters = {
  query: string;
  typeFilter: string;
  fuelFilter: string;
  statusFilter: string;
};

export function vehicleCardFilters(card: string): VehicleInventoryFilters {
  return {
    query: "",
    typeFilter: "all",
    fuelFilter: card === "all" || card === "enabled" ? "all" : card,
    statusFilter: card === "enabled" ? "enabled" : "all",
  };
}

export function matchesVehicleFilters(
  vehicle: { type: string; fuel_type: string; enabled: boolean },
  filters: VehicleInventoryFilters,
): boolean {
  if (filters.typeFilter !== "all" && vehicle.type !== filters.typeFilter) return false;
  if (filters.fuelFilter !== "all" && vehicle.fuel_type !== filters.fuelFilter) return false;
  if (filters.statusFilter === "enabled" && !vehicle.enabled) return false;
  if (filters.statusFilter === "disabled" && vehicle.enabled) return false;
  return true;
}