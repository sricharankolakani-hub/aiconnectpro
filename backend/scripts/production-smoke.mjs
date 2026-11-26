const baseUrl = new URL(process.env.AICP_SMOKE_BASE_URL || "https://aiconnectpro.vercel.app");
const pagePaths = [
  "/",
  "/index.html",
  "/login.html",
  "/signup.html",
  "/profile.html",
  "/settings.html",
  "/resume.html",
  "/connections.html",
  "/messages.html",
  "/reels.html",
  "/jobs.html",
  "/privacy-policy.html",
];
const failures = [];
const checked = new Set();

async function fetchChecked(url, label, expectedType) {
  const key = url.toString();
  if (checked.has(key)) return null;
  checked.add(key);

  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  } catch (error) {
    failures.push(`${label}: request failed (${error.message})`);
    return null;
  }

  if (!response.ok) {
    failures.push(`${label}: HTTP ${response.status}`);
    return null;
  }

  const contentType = response.headers.get("content-type") || "";
  if (expectedType && !contentType.toLowerCase().includes(expectedType)) {
    failures.push(`${label}: unexpected content type ${contentType || "(missing)"}`);
    return null;
  }

  return response;
}

for (const path of pagePaths) {
  const pageUrl = new URL(path, baseUrl);
  const response = await fetchChecked(pageUrl, path, "text/html");
  if (!response) continue;

  const html = await response.text();
  for (const match of html.matchAll(/<(?:script|link)\b[^>]*?(?:src|href)=["']([^"'#]+)["'][^>]*>/gi)) {
    const reference = match[1];
    const assetUrl = new URL(reference, pageUrl);
    if (assetUrl.origin !== baseUrl.origin || !/\.(?:m?js|css)$/i.test(assetUrl.pathname)) continue;

    const expectedType = assetUrl.pathname.endsWith(".css") ? "text/css" : "javascript";
    await fetchChecked(assetUrl, `${path} → ${assetUrl.pathname}`, expectedType);
  }
}

const readinessUrl = new URL("/api/ready", baseUrl);
const readinessResponse = await fetchChecked(readinessUrl, "/api/ready", "application/json");
if (readinessResponse) {
  try {
    const readiness = await readinessResponse.json();
    if (readiness.status !== "ready" || readiness.dependency !== "database") {
      failures.push(`/api/ready: unexpected response ${JSON.stringify(readiness)}`);
    }
  } catch {
    failures.push("/api/ready: response was not valid JSON");
  }
}

if (failures.length) {
  console.error("Production smoke check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Production smoke check passed: ${pagePaths.length} pages, ${checked.size - pagePaths.length} local JS/CSS assets, and database readiness.`);
}
