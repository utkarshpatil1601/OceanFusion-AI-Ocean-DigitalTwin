export async function readApiJson<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    const detail = response.status
      ? `HTTP ${response.status}`
      : "no HTTP response";
    throw new Error(
      `OceanFusion API returned a webpage instead of JSON (${detail}). Start the Flask API on port 5000, then reload the page.`,
    );
  }
  return await response.json() as T;
}
