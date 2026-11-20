import { afterEach, describe, expect, it, vi } from "vitest";
import { capturePhoto, cameraErrorMessage } from "./native-camera";

vi.mock("./native", () => ({ isNativePlatform: () => false }));
afterEach(() => vi.unstubAllGlobals());

describe("attendance camera-only capture", () => {
  it("requests the front camera without opening a file picker when permission is denied", async () => {
    const getUserMedia = vi.fn().mockRejectedValue({ name: "NotAllowedError" });
    const createElement = vi.fn();
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
    vi.stubGlobal("document", { createElement });
    await expect(capturePhoto({ front: true, cameraOnly: true })).rejects.toThrow("Allow Camera");
    expect(getUserMedia).toHaveBeenCalledWith({ video: { facingMode: { ideal: "user" }, width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
    expect(createElement).not.toHaveBeenCalled();
  });
  it("does not offer an old photo when the browser has no camera support", async () => {
    const createElement = vi.fn();
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("document", { createElement });
    await expect(capturePhoto({ cameraOnly: true })).rejects.toThrow("cannot open the camera");
    expect(createElement).not.toHaveBeenCalled();
  });
  it("identifies missing and busy cameras", () => {
    expect(cameraErrorMessage({ name: "NotFoundError" })).toContain("Connect a webcam");
    expect(cameraErrorMessage({ name: "NotReadableError" })).toContain("Close other apps");
  });
});