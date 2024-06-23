import { beforeEach, describe, expect, test, vitest } from "vitest";

import { generateBase64Image, getImageAsBase64 } from "../src/utils/encodeimage";

describe("generateBase64Image", async () => {
  beforeEach(() => {
    localStorage.clear();
    vitest.spyOn(console, "error").mockImplementation(() => {
      return null;
    });
  });

  test("should generate base64 image and cache it in local storage", async () => {
    const url = "https://example.com/image.jpg";
    const blob = new Blob(["test"], { type: "text/plain" });

    // @ts-expect-error - partially implemented fetch
    vitest.spyOn(window, "fetch").mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(blob),
    });

    await generateBase64Image(url);

    expect(window.fetch).toHaveBeenCalledWith(url);
    expect(localStorage.getItem(`image_${url}`)).toEqual("data:text/plain;base64,dGVzdA==");
  });

  test("should throw an error if failed to fetch image", async () => {
    const url = "https://example.com/image.jpg";

    // @ts-expect-error - partially implemented fetch
    vitest.spyOn(window, "fetch").mockResolvedValue({
      ok: false,
    });
    await generateBase64Image(url);
    expect(console.error).toHaveBeenCalledWith(
      "Failed to generate base64 image: Error: Failed to fetch image"
    );
  });

  test("should log error if failed to generate base64 image", async () => {
    const url = "https://example.com/image.jpg";
    vitest.spyOn(window, "fetch").mockRejectedValue(new Error("Network error"));
    vitest.spyOn(console, "error").mockImplementation(() => {
      return null;
    });

    await generateBase64Image(url);

    expect(console.error).toHaveBeenCalledWith(
      "Failed to generate base64 image: Error: Network error"
    );
  });
});

describe("getImageAsBase64", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("should return null for an invalid URL", () => {
    const base64 = getImageAsBase64("invalid-url");
    expect(base64).toBeNull();
  });

  test("should return null for a missing image", () => {
    const base64 = getImageAsBase64("https://example.com/missing.jpg");
    expect(base64).toBeNull();
  });

  test("should return base64 for a valid image URL", async () => {
    const blob = new Blob(["test"], { type: "text/plain" });
    // @ts-expect-error - partially implemented fetch
    vitest.spyOn(window, "fetch").mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(blob),
    });
    getImageAsBase64("https://example.com/image.jpg");
    await new Promise(resolve => setTimeout(resolve, 1000));
    const base64 = await getImageAsBase64("https://example.com/image.jpg");
    expect(base64).not.toBeNull();
  });

  test("should return cached base64 for a previously generated image", async () => {
    localStorage.setItem("image_https://example.com/image.jpg", "cached-base64");
    const base64 = getImageAsBase64("https://example.com/image.jpg");
    expect(base64).toEqual("cached-base64");
  });
});
