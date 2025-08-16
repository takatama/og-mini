const { load } = require("cheerio");
const iconv = require("iconv-lite");
const jschardet = require("jschardet");

// Use a realistic User-Agent and headers to avoid being blocked by some sites
const UA_BROWSERISH =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36";
const ACCEPT =
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8";
const ACCEPT_LANG = "ja,en-US;q=0.9,en;q=0.8";

// Timeouts and limits
const TTFB_TIMEOUT_MS = 8000; // Time to first byte timeout
const READ_IDLE_TIMEOUT_MS = 5000; // Idle timeout while streaming body
const MAX_HTML_BYTES = 1_500_000; // Limit for downloaded HTML (1.5MB)
const RETRIES = 1; // Retry once on timeout

function isHttpUrl(u) {
  try {
    const x = new URL(u);
    return x.protocol === "http:" || x.protocol === "https:";
  } catch {
    return false;
  }
}

function abs(base, maybe) {
  if (!maybe) return undefined;
  try {
    return new URL(maybe, base).toString();
  } catch {
    return undefined;
  }
}

/**
 * Fetch HTML with streaming, retry, and size/idle limits.
 */
async function fetchHtmlWithStreaming(url) {
  let lastError = null;

  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    const ttfbController = new AbortController();
    const ttfbTimer = setTimeout(() => ttfbController.abort(), TTFB_TIMEOUT_MS);

    try {
      const resp = await fetch(url, {
        redirect: "follow",
        signal: ttfbController.signal,
        headers: {
          "user-agent": UA_BROWSERISH,
          accept: ACCEPT,
          "accept-language": ACCEPT_LANG,
          "cache-control": "no-cache",
          pragma: "no-cache",
        },
      });
      clearTimeout(ttfbTimer);

      const ctype = resp.headers.get("content-type") || "";
      if (!ctype.includes("text/html")) {
        return { type: "non-html", resp };
      }

      // Stream body with idle-timeout and size limit
      const reader = resp.body.getReader();
      const chunks = [];
      let received = 0;

      let idleTimer;
      const resetIdle = () => {
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(
          () => reader.cancel("idle-timeout"),
          READ_IDLE_TIMEOUT_MS
        );
      };
      resetIdle();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        resetIdle();

        if (value) {
          chunks.push(value);
          received += value.length;
          if (received > MAX_HTML_BYTES) {
            break; // stop reading when limit is reached
          }
        }
      }
      if (idleTimer) clearTimeout(idleTimer);

      // Concatenate all chunks into a buffer
      const buffer = Buffer.concat(chunks, Math.min(received, MAX_HTML_BYTES));

      // Detect encoding from HTML content
      let encoding = "utf8";

      try {
        // First, try to find charset in Content-Type header
        const contentType = resp.headers.get("content-type") || "";
        const charsetMatch = contentType.match(/charset=([^;,\s]+)/i);
        if (charsetMatch) {
          encoding = charsetMatch[1].toLowerCase();
        } else {
          // If no charset in header, try to detect from HTML meta tags
          const htmlStart = buffer.toString(
            "ascii",
            0,
            Math.min(buffer.length, 2048)
          );
          const metaCharsetMatch = htmlStart.match(
            /<meta[^>]*charset\s*=\s*["\']?([^"\'>\s]+)/i
          );
          if (metaCharsetMatch) {
            encoding = metaCharsetMatch[1].toLowerCase();
          } else {
            // Last resort: use jschardet to detect encoding
            const detected = jschardet.detect(buffer);
            if (detected && detected.encoding && detected.confidence > 0.8) {
              encoding = detected.encoding.toLowerCase();
            }
          }
        }

        // Convert to UTF-8 if needed
        let html;
        if (encoding === "utf8" || encoding === "utf-8") {
          html = buffer.toString("utf8");
        } else if (iconv.encodingExists(encoding)) {
          html = iconv.decode(buffer, encoding);
        } else {
          // Fallback to utf-8
          html = buffer.toString("utf8");
        }

        return { type: "ok", resp, html };
      } catch (encodingError) {
        // If encoding detection/conversion fails, fallback to utf-8
        const html = buffer.toString("utf8");
        return { type: "ok", resp, html };
      }
    } catch (e) {
      clearTimeout(ttfbTimer);
      lastError = e;

      const name = e?.name || "";
      const msg = (e?.message || "").toLowerCase();
      const isTimeout =
        name === "AbortError" ||
        msg.includes("timed") ||
        msg.includes("timeout") ||
        msg.includes("idle-timeout");

      if (attempt < RETRIES && isTimeout) {
        await new Promise((r) =>
          setTimeout(r, 200 + Math.floor(Math.random() * 300))
        );
        continue;
      } else {
        throw e;
      }
    }
  }
  throw lastError || new Error("fetch failed");
}

// API Key validation function
function validateApiKey(req) {
  const apiKey = req.headers["x-api-key"] || req.query.key;
  const validApiKeys = process.env.API_KEYS;

  if (!validApiKeys) {
    // Skip Authentication if API_KEYS is not set
    return true;
  }

  if (!apiKey) {
    return false;
  }

  const validKeys = validApiKeys.split(",").map((key) => key.trim());
  return validKeys.includes(apiKey);
}

exports.og = async (req, res) => {
  // API Key validation
  if (!validateApiKey(req)) {
    return res.status(401).json({
      error: "unauthorized",
      message:
        "Valid API key required in X-API-Key header or 'key' query parameter",
    });
  }

  const target = (req.query.url || "").toString();
  if (!isHttpUrl(target)) {
    return res.status(400).json({ error: "invalid url" });
  }

  let result;
  try {
    result = await fetchHtmlWithStreaming(target);
  } catch (e) {
    const msg =
      e?.name === "AbortError" ? "timeout" : e?.message || "fetch failed";
    return res.status(504).json({ error: msg, url: target });
  }

  if (result.type === "non-html") {
    return res.status(422).json({
      error: "content is not HTML",
      url: target,
      finalUrl: result.resp.url,
      contentType: result.resp.headers.get("content-type") || "",
    });
  }

  const { resp, html } = result;
  const finalUrl = resp.url;
  const $ = load(html);

  const pick = (...selectors) => {
    for (const s of selectors) {
      const v = $(s).attr("content") || $(s).attr("value");
      if (v && v.trim()) return v.trim();
    }
    return undefined;
  };

  const title =
    pick('meta[property="og:title"]', 'meta[name="twitter:title"]') ||
    $("title").first().text()?.trim() ||
    undefined;

  const description = pick(
    'meta[property="og:description"]',
    'meta[name="twitter:description"]',
    'meta[name="description"]'
  );

  const image = abs(
    finalUrl,
    pick(
      'meta[property="og:image:secure_url"]',
      'meta[property="og:image:url"]',
      'meta[property="og:image"]',
      'meta[name="twitter:image"]'
    )
  );

  const siteName = pick('meta[property="og:site_name"]');
  const type = pick('meta[property="og:type"]');
  const lang = $("html").attr("lang") || pick('meta[property="og:locale"]');

  const icoHref =
    $('link[rel~="icon"]').attr("href") ||
    $('link[rel="shortcut icon"]').attr("href") ||
    "/favicon.ico";
  const favicon = abs(finalUrl, icoHref);

  res.setHeader("Cache-Control", "public, max-age=86400"); // allow caching for 1 day
  res.setHeader("Access-Control-Allow-Origin", "*"); // adjust if you want to restrict origins
  res.status(200).json({
    url: target,
    finalUrl,
    title,
    description,
    image,
    siteName,
    type,
    lang,
    favicon,
    fetchedAt: new Date().toISOString(),
  });
};
