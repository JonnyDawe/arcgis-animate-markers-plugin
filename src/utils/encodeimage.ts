export async function generateBase64Image(url: string): Promise<void> {
  const cacheKey = `image_${url}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Failed to fetch image");
    }
    const blob = await response.blob();
    const base64 = await blobToData(blob);
    localStorage.setItem(cacheKey, base64);
  } catch (error) {
    console.error(`Failed to generate base64 image: ${error}`);
  }
}

const blobToData = async (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read blob"));
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
};

export function getImageAsBase64(url: string): string | null {
  const cacheKey = `image_${url}`;
  const cachedImage = localStorage.getItem(cacheKey);
  if (cachedImage) {
    return cachedImage;
  } else {
    generateBase64Image(url);
    return null;
  }
}
