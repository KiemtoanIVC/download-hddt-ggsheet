function hddtSleep(ms) {
  Utilities.sleep(ms);
}

function hddtGetApiBaseUrl() {
  const scriptValue = String(PropertiesService.getScriptProperties().getProperty("GDT_API_BASE_URL") || "").trim();
  // :30000 was the retired provider host. Retain a configurable base for a
  // future tunnel, but never let an old property restore the broken endpoint.
  if (scriptValue && scriptValue.indexOf(":30000") < 0) return scriptValue.replace(/\/$/, "");
  return HDDT_DEFAULTS.API_BASE_URL;
}

function hddtBuildQueryString(params) {
  const parts = [];
  Object.keys(params || {}).forEach((key) => {
    const value = params[key];
    if (value === undefined || value === null || value === "") return;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  });
  return parts.length > 0 ? `?${parts.join("&")}` : "";
}

function hddtGetDefaultHeaders(token) {
  const headers = {
    Accept: "application/json, text/plain, */*",
    "Content-Type": "application/json",
    Origin: "https://hoadondientu.gdt.gov.vn",
    Referer: "https://hoadondientu.gdt.gov.vn/",
    "End-Point": "/tra-cuu/tra-cuu-hoa-don",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

function hddtFetchWithRetry(url, options, retryOptions) {
  const retries = Number((retryOptions && retryOptions.retries) || 3);
  const backoffMs = Number((retryOptions && retryOptions.backoffMs) || 500);
  const config = Object.assign({ muteHttpExceptions: true, followRedirects: true }, options || {});

  for (let attempt = 0; attempt <= retries; attempt++) {
    // GDT requires a fresh correlation ID for every HDDT API dispatch. Do
    // this inside the retry loop: a request-id from a failed request must not
    // be reused by its retry.
    const requestConfig = Object.assign({}, config, {
      headers: Object.assign({}, config.headers || {}, {
        "request-id": Utilities.getUuid(),
      }),
    });
    const response = UrlFetchApp.fetch(url, requestConfig);
    const statusCode = response.getResponseCode();
    const shouldRetry = statusCode === 429 || statusCode >= 500;

    if (!shouldRetry || attempt === retries) {
      return response;
    }

    hddtSleep(backoffMs * Math.pow(2, attempt));
  }

  throw new Error("Unreachable fetch retry branch");
}

function hddtParseHttpResponse(response) {
  const statusCode = response.getResponseCode();
  const text = response.getContentText();
  let json = null;

  try {
    json = JSON.parse(text);
  } catch (_error) {
    json = null;
  }

  return {
    statusCode,
    text,
    json,
    headers: response.getAllHeaders ? response.getAllHeaders() : response.getHeaders(),
  };
}

function hddtRequestJson(config) {
  const method = (config.method || "get").toUpperCase();
  const url = config.url;
  const token = config.token || "";

  const options = {
    method,
    headers: Object.assign({}, hddtGetDefaultHeaders(token), config.headers || {}),
  };

  if (config.payload !== undefined) {
    options.payload = typeof config.payload === "string" ? config.payload : JSON.stringify(config.payload);
  }

  const response = hddtFetchWithRetry(url, options, config.retry);
  const parsed = hddtParseHttpResponse(response);

  if (parsed.statusCode >= 400) {
    const message = parsed.json && parsed.json.message ? parsed.json.message : parsed.text;
    throw new Error(`HTTP ${parsed.statusCode}: ${message}`);
  }

  return parsed;
}
