const HDDT_LICENSE = {
  PREFIX: "HDDT1",
  PROP_SECRET: "HDDT_LICENSE_SECRET",
  PROP_ACTIVE_KEY: "HDDT_LICENSE_ACTIVE_KEY",
};

function hddtLicenseNowMs() {
  return Date.now();
}

function hddtLicenseGetCurrentSheetId() {
  return getEffectiveDatabaseSpreadsheetId();
}

function hddtLicenseGetSecret() {
  const props = PropertiesService.getScriptProperties();
  let secret = props.getProperty(HDDT_LICENSE.PROP_SECRET) || "";
  if (!secret) {
    secret = `${Utilities.getUuid()}-${Utilities.getUuid()}`;
    props.setProperty(HDDT_LICENSE.PROP_SECRET, secret);
  }
  return secret;
}

function hddtLicenseSign(payloadB64) {
  const secret = hddtLicenseGetSecret();
  const bytes = Utilities.computeHmacSha256Signature(payloadB64, secret);
  return Utilities.base64EncodeWebSafe(bytes);
}

function hddtLicenseEncodePayload(payload) {
  return Utilities.base64EncodeWebSafe(JSON.stringify(payload || {}));
}

function hddtLicenseDecodePayload(payloadB64) {
  try {
    const text = Utilities.newBlob(Utilities.base64DecodeWebSafe(payloadB64)).getDataAsString();
    return JSON.parse(text);
  } catch (_error) {
    return null;
  }
}

function hddtLicenseBuildKey(payload) {
  const payloadB64 = hddtLicenseEncodePayload(payload);
  const sig = hddtLicenseSign(payloadB64);
  return `${HDDT_LICENSE.PREFIX}.${payloadB64}.${sig}`;
}

function hddtLicenseParseKey(licenseKey) {
  const raw = String(licenseKey || "").trim();
  if (!raw) return { ok: false, reason: "Thiếu license key." };
  const parts = raw.split(".");
  if (parts.length !== 3 || parts[0] !== HDDT_LICENSE.PREFIX) {
    return { ok: false, reason: "License key không đúng định dạng." };
  }

  const payloadB64 = parts[1];
  const signature = parts[2];
  const expected = hddtLicenseSign(payloadB64);
  if (signature !== expected) {
    return { ok: false, reason: "License key sai chữ ký." };
  }

  const payload = hddtLicenseDecodePayload(payloadB64);
  if (!payload || typeof payload !== "object") {
    return { ok: false, reason: "License payload không hợp lệ." };
  }

  return { ok: true, payload };
}

function hddtLicenseValidatePayload(payload, options) {
  const skipConfiguredMstCheck = Boolean(options && options.skipConfiguredMstCheck);
  const now = hddtLicenseNowMs();
  const mst = String(payload.mst || "").trim();
  const sheetId = String(payload.sheetId || "").trim();
  const exp = Number(payload.exp || 0);
  const iat = Number(payload.iat || 0);

  if (!mst) return { valid: false, reason: "License thiếu MST." };
  if (!sheetId) return { valid: false, reason: "License thiếu sheetId." };
  if (!exp || !Number.isFinite(exp)) return { valid: false, reason: "License thiếu thời hạn." };
  if (exp <= now) return { valid: false, reason: "License đã hết hạn." };
  if (!iat || !Number.isFinite(iat)) return { valid: false, reason: "License thiếu thời điểm cấp." };

  const currentSheetId = hddtLicenseGetCurrentSheetId();
  if (currentSheetId !== sheetId) {
    return { valid: false, reason: `Sheet không khớp license (${sheetId}).` };
  }

  const creds = hddtGetCredentials();
  const configuredMst = String(creds.mst || "").trim();
  if (!skipConfiguredMstCheck && configuredMst && configuredMst !== mst) {
    return { valid: false, reason: `MST cấu hình (${configuredMst}) không khớp license (${mst}).` };
  }

  return {
    valid: true,
    reason: "",
    mst,
    sheetId,
    exp,
    iat,
    now,
    daysLeft: Math.ceil((exp - now) / (24 * 60 * 60 * 1000)),
  };
}

function hddtGetLicenseStatus() {
  const activeKey = hddtGetUserProperties().getProperty(HDDT_LICENSE.PROP_ACTIVE_KEY) || "";
  if (!activeKey) {
    return {
      hasKey: false,
      valid: false,
      reason: "Chưa kích hoạt license.",
      sheetId: hddtLicenseGetCurrentSheetId(),
    };
  }

  const parsed = hddtLicenseParseKey(activeKey);
  if (!parsed.ok) {
    return {
      hasKey: true,
      valid: false,
      reason: parsed.reason,
      sheetId: hddtLicenseGetCurrentSheetId(),
    };
  }

  const validation = hddtLicenseValidatePayload(parsed.payload || {});
  return {
    hasKey: true,
    valid: Boolean(validation.valid),
    reason: validation.reason || "",
    mst: validation.mst || parsed.payload.mst || "",
    sheetId: validation.sheetId || parsed.payload.sheetId || "",
    expiresAt: validation.exp || parsed.payload.exp || 0,
    issuedAt: validation.iat || parsed.payload.iat || 0,
    daysLeft: validation.daysLeft || 0,
  };
}

function hddtActivateLicense(input) {
  const licenseKey = String((input && input.licenseKey) || "").trim();
  const parsed = hddtLicenseParseKey(licenseKey);
  if (!parsed.ok) {
    throw new Error(parsed.reason || "License key không hợp lệ.");
  }

  const validation = hddtLicenseValidatePayload(parsed.payload || {}, {
    skipConfiguredMstCheck: true,
  });
  if (!validation.valid) {
    throw new Error(validation.reason || "License không hợp lệ.");
  }

  const props = hddtGetUserProperties();
  props.setProperty(HDDT_LICENSE.PROP_ACTIVE_KEY, licenseKey);
  // Keep configured MST aligned with the activated license to avoid stale MST mismatch.
  props.setProperty(HDDT_PROP_KEYS.MST, String(validation.mst || ""));
  // Force re-login when license/MST changes.
  hddtClearSession();
  return {
    ok: true,
    message: "Kích hoạt license thành công.",
    license: hddtGetLicenseStatus(),
  };
}

function hddtDeactivateLicense() {
  hddtGetUserProperties().deleteProperty(HDDT_LICENSE.PROP_ACTIVE_KEY);
  hddtClearSession();
  return {
    ok: true,
    message: "Đã xóa license đang kích hoạt.",
    license: hddtGetLicenseStatus(),
  };
}

function hddtGenerateTestLicense(input) {
  const mst = String((input && input.mst) || "").trim();
  const sheetId = String((input && input.sheetId) || "").trim() || hddtLicenseGetCurrentSheetId();
  const days = Math.max(1, Number((input && input.days) || 365));
  const plan = String((input && input.plan) || "MVP-TEST");

  if (!mst) throw new Error("Thiếu MST để tạo test license.");
  if (!sheetId) throw new Error("Thiếu sheetId để tạo test license.");

  const now = hddtLicenseNowMs();
  const payload = {
    mst,
    sheetId,
    plan,
    iat: now,
    exp: now + days * 24 * 60 * 60 * 1000,
  };

  const licenseKey = hddtLicenseBuildKey(payload);
  return {
    ok: true,
    licenseKey,
    payload,
    note: "MVP local generator. Production should issue keys from external license server.",
  };
}

function hddtAssertLicense(action) {
  // A bound script used by one Sheet does not require a licensing layer.
  return { valid: true, action: String(action || "") };
}
