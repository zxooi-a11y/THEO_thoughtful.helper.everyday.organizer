// Cookie holds a SHA-256 of the passcode (never the passcode itself).
export async function passcodeToken(passcode: string): Promise<string> {
  const data = new TextEncoder().encode("theo:" + passcode);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}
