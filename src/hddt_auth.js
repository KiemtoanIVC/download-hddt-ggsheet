function hddtExtractField(obj, keys) {
  if (!obj || typeof obj !== "object") return "";
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "") {
      return obj[key];
    }
  }
  return "";
}

function hddtInferImageMime(bytes, fallback) {
  try {
    if (!bytes || bytes.length < 4) return fallback || "image/png";
    const b0 = bytes[0];
    const b1 = bytes[1];
    const b2 = bytes[2];
    const b3 = bytes[3];

    // PNG: 89 50 4E 47
    if (b0 === 0x89 && b1 === 0x50 && b2 === 0x4e && b3 === 0x47) return "image/png";
    // JPEG: FF D8
    if (b0 === 0xff && b1 === 0xd8) return "image/jpeg";
    // GIF: 47 49 46 38
    if (b0 === 0x47 && b1 === 0x49 && b2 === 0x46 && b3 === 0x38) return "image/gif";
    // WebP: RIFF....WEBP
    if (b0 === 0x52 && b1 === 0x49 && b2 === 0x46 && b3 === 0x46 && bytes.length >= 12) {
      if (bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "image/webp";
    }
    return fallback || "image/png";
  } catch (_err) {
    return fallback || "image/png";
  }
}

function hddtExtractToken(payload) {
  if (!payload || typeof payload !== "object") return "";

  const directToken = hddtExtractField(payload, ["token", "accessToken", "id_token", "jwt", "bearerToken"]);
  if (directToken) return String(directToken);

  const nestedData = payload.data || payload.result || payload.obj || payload.payload || {};
  const nestedToken = hddtExtractField(nestedData, ["token", "accessToken", "id_token", "jwt", "bearerToken"]);
  if (nestedToken) return String(nestedToken);

  return "";
}

function hddtGetCaptcha() {
  const url = `${hddtGetApiBaseUrl()}/captcha?timestamp=${Date.now()}`;
  const browserHeaders = {
    Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    Origin: "https://hoadondientu.gdt.gov.vn",
    Referer: "https://hoadondientu.gdt.gov.vn/",
  };
  const response = hddtFetchWithRetry(url, {
    method: "get",
    headers: {
      ...browserHeaders,
    },
    muteHttpExceptions: true,
  }, { retries: 1, backoffMs: 500 });

  const statusCode = response.getResponseCode();
  if (statusCode >= 400) {
    throw new Error(`Captcha request failed: HTTP ${statusCode}`);
  }

  const headers = response.getHeaders();
  const contentType = String(headers["Content-Type"] || headers["content-type"] || "");
  const text = response.getContentText();
  const rawBytes = response.getContent();

  let captchaKey = "";
  let captchaImage = "";

  try {
    const json = JSON.parse(text);
    captchaKey = String(
      hddtExtractField(json, ["captchaKey", "ckey", "key"]) ||
      hddtExtractField(json.data || {}, ["captchaKey", "ckey", "key"]) ||
      ""
    );

    const rawImage =
      hddtExtractField(json, ["content", "captcha", "captchaImage", "image", "base64"]) ||
      hddtExtractField(json.data || {}, ["content", "captcha", "captchaImage", "image", "base64"]) ||
      "";

    if (rawImage) {
      const imageAsString = String(rawImage);
      if (imageAsString.startsWith("data:image")) {
        captchaImage = imageAsString;
      } else if (/^\s*<svg[\s>]/i.test(imageAsString) || /<svg[\s>]/i.test(imageAsString)) {
        captchaImage = `data:image/svg+xml;base64,${Utilities.base64Encode(imageAsString)}`;
      } else {
        captchaImage = `data:image/png;base64,${imageAsString}`;
      }
    }

    if (!captchaImage) {
      const captchaUrl =
        hddtExtractField(json, ["captchaUrl", "imageUrl", "url"]) ||
        hddtExtractField(json.data || {}, ["captchaUrl", "imageUrl", "url"]) ||
        "";
      const resolvedUrl = String(captchaUrl || "");
      if (resolvedUrl && /^https?:\/\//i.test(resolvedUrl)) {
        const imgResponse = hddtFetchWithRetry(resolvedUrl, {
          method: "get",
          headers: { ...browserHeaders },
          muteHttpExceptions: true,
        }, { retries: 0, backoffMs: 0 });
        if (imgResponse.getResponseCode() < 400) {
          const imgHeaders = imgResponse.getHeaders();
          const imgContentType = String(imgHeaders["Content-Type"] || imgHeaders["content-type"] || "");
          const imgBytes = imgResponse.getContent();
          if (imgBytes && imgBytes.length > 0) {
            const mime = hddtInferImageMime(imgBytes, imgContentType && imgContentType.indexOf("image/") === 0 ? imgContentType : "");
            captchaImage = `data:${mime};base64,${Utilities.base64Encode(imgBytes)}`;
          }
        }
      }
    }
  } catch (_error) {
    captchaKey = String(headers["ckey"] || headers["x-captcha-key"] || "");
    if (contentType.indexOf("image") >= 0) {
      const bytes = response.getContent();
      const mime = hddtInferImageMime(bytes, contentType);
      captchaImage = `data:${mime};base64,${Utilities.base64Encode(bytes)}`;
    }
  }

  if (!captchaKey) {
    captchaKey = String(headers["ckey"] || headers["x-captcha-key"] || "");
  }

  if (!captchaImage && contentType.indexOf("image") >= 0) {
    const bytes = response.getContent();
    const mime = hddtInferImageMime(bytes, contentType);
    captchaImage = `data:${mime};base64,${Utilities.base64Encode(bytes)}`;
  }

  if (!captchaImage) {
    const ct = contentType.toLowerCase();
    const looksLikeHtml = ct.indexOf("text/html") >= 0 || /^\s*<!doctype\s+html/i.test(text) || /<html[\s>]/i.test(text);
    if (looksLikeHtml) {
      const snippet = String(text || "").slice(0, 200);
      throw new Error(`Captcha response is HTML (possible redirect/block). contentType=${contentType || "(empty)"}. Snippet: ${snippet}`);
    }

    const bytesLen = rawBytes ? rawBytes.length : 0;
    const canTreatAsBinaryImage = bytesLen > 0 && (ct.indexOf("image/") >= 0 || ct.indexOf("application/octet-stream") >= 0 || ct === "");
    if (canTreatAsBinaryImage) {
      const mime = hddtInferImageMime(rawBytes, ct.indexOf("image/") === 0 ? contentType : "");
      captchaImage = `data:${mime};base64,${Utilities.base64Encode(rawBytes)}`;
    }
  }

  if (captchaKey && !captchaImage) {
    const retryResponse = hddtFetchWithRetry(url, {
      method: "get",
      headers: {
        ...browserHeaders,
      },
      muteHttpExceptions: true,
    }, { retries: 0, backoffMs: 0 });

    const retryStatus = retryResponse.getResponseCode();
    if (retryStatus < 400) {
      const retryHeaders = retryResponse.getHeaders();
      const retryContentType = String(retryHeaders["Content-Type"] || retryHeaders["content-type"] || contentType || "");
      const retryBytes = retryResponse.getContent();
      if (retryBytes && retryBytes.length > 0) {
        const mime = hddtInferImageMime(retryBytes, String(retryContentType || "").indexOf("image/") === 0 ? retryContentType : "");
        captchaImage = `data:${mime};base64,${Utilities.base64Encode(retryBytes)}`;
      }
    }
  }

  if (!captchaKey) {
    throw new Error("Không lấy được captchaKey từ HDDT.");
  }

  hddtLog("INFO", "getCaptcha", "Fetched captcha", {
    captchaKey,
    hasImage: Boolean(captchaImage),
    contentType,
    bytes: rawBytes ? rawBytes.length : 0,
  });

  return {
    captchaKey,
    captchaImage,
    debug: !captchaImage
      ? {
          contentType,
          bytes: rawBytes ? rawBytes.length : 0,
          headerKeys: Object.keys(headers || {}),
          textSnippet: String(text || "").slice(0, 200),
        }
      : undefined,
    fetchedAt: hddtNowIso(),
  };
}

function hddtLogin(input) {
  const username = String((input && input.username) || "").trim();
  const password = String((input && input.password) || "");
  const mst = String((input && input.mst) || "").trim();
  const captcha = String((input && input.captcha) || "").trim();
  const captchaKey = String((input && input.captchaKey) || "").trim();

  if (!username || !password) {
    throw new Error("Thiếu username/password.");
  }
  if (!captcha || !captchaKey) {
    throw new Error("Thiếu captcha/captchaKey.");
  }

  // Retain only username/MST and the short-lived token; never persist passwords.
  hddtSaveCredentials({ username, password: null, mst });

  const url = `${hddtGetApiBaseUrl()}/security-taxpayer/authenticate`;
  const payload = {
    username,
    password,
    ckey: captchaKey,
    cvalue: captcha,
  };

  const parsed = hddtRequestJson({
    method: "post",
    url,
    payload,
    headers: {
      "Content-Type": "application/json",
    },
    retry: { retries: 1, backoffMs: 500 },
  });

  const responseJson = parsed.json || {};
  const token = hddtExtractToken(responseJson);

  if (!token) {
    const responseMessage = hddtExtractField(responseJson, ["message", "error", "detail"]) || "Không lấy được token.";
    throw new Error(responseMessage);
  }

  const expiresAt = Date.now() + HDDT_DEFAULTS.TOKEN_TTL_MS;
  hddtSaveSession(token, expiresAt);
  hddtLog("INFO", "login", "Login thành công", { username, mst });

  return {
    ok: true,
    message: "Đăng nhập thành công",
    expiresAt,
    session: hddtGetSession(),
  };
}

function hddtRequireToken() {
  const session = hddtGetSession();
  if (!session.isValid) {
    throw new Error("Phiên đăng nhập HDDT đã hết hạn. Vui lòng đăng nhập lại.");
  }
  return session.token;
}
