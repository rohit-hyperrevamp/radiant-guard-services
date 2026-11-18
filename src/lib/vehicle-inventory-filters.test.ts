import { describe, expect, it } from "vitest";
import { matchesVehicleFilters, vehicleCardFilters } from "./vehicle-inventory-filters";

const vehicles = [
  { id: "petrol-on", type: "Car", fuel_type: "Petrol", enabled: true },
  { id: "petrol-off", type: "Bike", fuel_type: "Petrol", enabled: false },
  { id: "diesel", type: "Truck", fuel_type: "Diesel", enabled: true },
  { id: "cng", type: "Auto", fuel_type: "CNG", enabled: true },
  { id: "electric", type: "Car", fuel_type: "Electric", enabled: false },
  { id: "hybrid", type: "Car", fuel_type: "Hybrid", enabled: true },
  { id: "lpg", type: "Van", fuel_type: "LPG", enabled: true },
];
const listed = (card: string) => vehicles.filter((v) => matchesVehicleFilters(v, vehicleCardFilters(card))).map((v) => v.id);

describe("Vehicle inventory card sections", () => {
  it("Total Vehicles includes every fuel and both statuses", () => {
    expect(listed("all")).toEqual(vehicles.map((v) => v.id));
  });
  it("Enabled includes enabled vehicles across every fuel", () => {
    expect(listed("enabled")).toEqual(["petrol-on", "diesel", "cng", "hybrid", "lpg"]);
  });
  it("Petrol includes only petrol vehicles, including disabled ones", () => {
    expect(listed("Petrol")).toEqual(["petrol-on", "petrol-off"]);
  });
  it.each(["Diesel", "CNG", "Electric", "Hybrid"])("%s includes only that fuel", (fuel) => {
    expect(listed(fuel)).toEqual([fuel.toLowerCase()]);
  });
  it("card selection clears previous search, type and unrelated filters", () => {
    expect(vehicleCardFilters("Diesel")).toEqual({ query: "", typeFilter: "all", fuelFilter: "Diesel", statusFilter: "all" });
    expect(vehicleCardFilters("all")).toEqual({ query: "", typeFilter: "all", fuelFilter: "all", statusFilter: "all" });
  });
});