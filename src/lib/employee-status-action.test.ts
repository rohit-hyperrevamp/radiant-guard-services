import { describe, expect, it, vi } from "vitest";
import { requestEmployeeStatusAction } from "./employee-status-action";

describe("employee list status workflow", () => {
  it("opens offboarding only after confirmation", async () => {
    const startOffboarding = vi.fn();
    const reactivate = vi.fn();
    const confirmOffboarding = vi.fn(async () => true);
    await requestEmployeeStatusAction({ active: true, confirmOffboarding, startOffboarding, reactivate });
    expect(confirmOffboarding).toHaveBeenCalledOnce();
    expect(startOffboarding).toHaveBeenCalledOnce();
    expect(reactivate).not.toHaveBeenCalled();
  });
  it("leaves the employee unchanged when confirmation is cancelled", async () => {
    const startOffboarding = vi.fn();
    const reactivate = vi.fn();
    await requestEmployeeStatusAction({ active: true, confirmOffboarding: async () => false, startOffboarding, reactivate });
    expect(startOffboarding).not.toHaveBeenCalled();
    expect(reactivate).not.toHaveBeenCalled();
  });
  it("keeps inactive employees on the existing reactivation path", async () => {
    const startOffboarding = vi.fn();
    const reactivate = vi.fn();
    const confirmOffboarding = vi.fn(async () => true);
    await requestEmployeeStatusAction({ active: false, confirmOffboarding, startOffboarding, reactivate });
    expect(reactivate).toHaveBeenCalledOnce();
    expect(confirmOffboarding).not.toHaveBeenCalled();
    expect(startOffboarding).not.toHaveBeenCalled();
  });
});