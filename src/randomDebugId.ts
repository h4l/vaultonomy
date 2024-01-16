/**
 * Get a 32-bit random hex string, for use as a visual identifier to aid debugging.
 */
export function randomDebugId(): string {
  const bytes = new Uint8Array(4);
  // can be used from insecure contexts, like our non-https dev-server page
  crypto.getRandomValues(bytes);

  return [...bytes].map((n) => n.toString(16).padStart(2, "0")).join("");
}
