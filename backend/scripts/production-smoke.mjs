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
const checkedAssets = new Set();

async function fetchChecked(url, label, expectedType, { retries = 0, retryDelayMs = 0 } = {}) {
  const key = url.toString();
  if (checked.has(key)) return null;

  let lastFailure = "request failed";
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!response.ok) {
        lastFailure = `HTTP ${response.status}`;
      } else {
        const contentType = response.headers.get("content-type") || "";
        if (expectedType && !contentType.toLowerCase().includes(expectedType)) {
          lastFailure = `unexpected content type ${contentType || "(missing)"}`;
        } else {
          checked.add(key);
          return response;
        }
      }
    } catch (error) {
      lastFailure = `request failed (${error.message})`;
    }

    if (attempt < retries) {
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }

  checked.add(key);
  failures.push(`${label}: ${lastFailure}`);
  return null;
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

    checkedAssets.add(assetUrl.toString());
    const expectedType = assetUrl.pathname.endsWith(".css") ? "text/css" : "javascript";
    await fetchChecked(assetUrl, `${path} → ${assetUrl.pathname}`, expectedType);
  }
}

const readinessUrl = new URL("/api/ready", baseUrl);
const readinessResponse = await fetchChecked(readinessUrl, "/api/ready", "application/json", { retries: 5, retryDelayMs: 10_000 });
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
  console.log(`Production smoke check passed: ${pagePaths.length} pages, ${checkedAssets.size} local JS/CSS assets, and database readiness.`);
}
