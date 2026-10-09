export type PendingDocument = { id: string; file: File; title: string };

export function documentPath(parentId: string, title: string, filename: string) {
  return `${parentId}/${crypto.randomUUID()}--${encodeURIComponent(title.trim())}--${encodeURIComponent(filename)}`;
}

export function documentNames(path: string) {
  const leaf = path.split("/").pop() ?? "Document";
  const parts = leaf.split("--");
  if (parts.length >= 3) {
    try { return { title: decodeURIComponent(parts[1]), filename: decodeURIComponent(parts.slice(2).join("--")) }; } catch { /* Legacy names remain readable. */ }
  }
  const filename = leaf.replace(/^\d+-/, "");
  return { title: filename, filename };
}

export async function downloadDocument(url: string, filename: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Could not download document. Please try again.");
  const objectUrl = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}