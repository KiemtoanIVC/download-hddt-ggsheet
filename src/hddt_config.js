const HDDT_SHEETS = {
  SUMMARY: "HDDT_Hoa_don",
  DETAIL: "HDDT_Chi_tiet",
  DETAIL_LINE: "HDDT_Dong_hang",
  SYNC_RUN: "HDDT_Dong_bo",
  LOG: "HDDT_Nhat_ky",
};

const HDDT_HEADERS = {
  summary: [
    "summaryKey",
    "invoiceKey",
    "category",
    "ttxly",
    "fromDate",
    "toDate",
    "monthLabel",
    "downloadMonth",
    "stt",
    "formSymbol",
    "invoiceSymbol",
    "invoiceNumber",
    "invoiceDate",
    "sellerTaxCode",
    "sellerName",
    "sellerAddress",
    "buyerTaxCode",
    "buyerName",
    "buyerAddress",
    "buyerIdNo",
    "totalBeforeTax",
    "totalTax",
    "totalDiscount",
    "totalFee",
    "totalPayment",
    "counterpartyTaxCode",
    "counterpartyStatusCode",
    "counterpartyStatusText",
    "counterpartyIsHighRisk",
    "currency",
    "exchangeRate",
    "invoiceStatus",
    "checkResult",
    "sourceHeaders",
    "raw",
    "createdAt",
    "updatedAt",
  ],
  detail: [
    "detailKey",
    "summaryKey",
    "invoiceKey",
    "category",
    "ttxly",
    "payload",
    "lineCount",
    "fetchedAt",
    "updatedAt",
  ],
  detailLine: [
    "lineKey",
    "detailKey",
    "summaryKey",
    "invoiceKey",
    "category",
    "ttxly",
    "stt",
    "tchat",
    "loaiHangHoaDacTrung",
    "ten",
    "dvtinh",
    "sluong",
    "dgia",
    "stckhau",
    "tsuat",
    "thtien",
    "tthue",
    "lineNature",
    "signedAmount",
    "signedTaxAmount",
    "raw",
    "updatedAt",
  ],
  syncRun: [
    "syncRunId",
    "startedAt",
    "finishedAt",
    "category",
    "fromDate",
    "toDate",
    "includeDetails",
    "status",
    "currentStep",
    "summaryTotal",
    "summaryDone",
    "summaryFailed",
    "detailTotal",
    "detailDone",
    "errorMessage",
  ],
  log: ["timestamp", "level", "action", "message", "meta"],
};

const HDDT_PROP_KEYS = {
  USERNAME: "HDDT_USERNAME",
  PASSWORD_B64: "HDDT_PASSWORD_B64",
  MST: "HDDT_MST",
  TOKEN: "HDDT_TOKEN",
  TOKEN_MST: "HDDT_TOKEN_MST",
  TOKEN_EXPIRES_AT: "HDDT_TOKEN_EXPIRES_AT",
  LAST_LOGIN_AT: "HDDT_LAST_LOGIN_AT",
};

const HDDT_DEFAULTS = {
  API_BASE_URL: "https://hoadondientu.gdt.gov.vn/api",
  PAGE_SIZE: 50,
  MAX_PAGES_PER_CHUNK: 20,
  TOKEN_TTL_MS: 24 * 60 * 60 * 1000,
};

function hddtNowIso() {
  return new Date().toISOString();
}

function hddtGetUserProperties() {
  return PropertiesService.getUserProperties();
}

function hddtEncodeSecret(value) {
  return Utilities.base64EncodeWebSafe(String(value || ""));
}

function hddtDecodeSecret(value) {
  if (!value) return "";
  return Utilities.newBlob(Utilities.base64DecodeWebSafe(value)).getDataAsString();
}

function hddtGetCredentials() {
  const props = hddtGetUserProperties();
  return {
    username: props.getProperty(HDDT_PROP_KEYS.USERNAME) || "",
    password: hddtDecodeSecret(props.getProperty(HDDT_PROP_KEYS.PASSWORD_B64) || ""),
    mst: props.getProperty(HDDT_PROP_KEYS.MST) || "",
  };
}

function hddtSaveCredentials(input) {
  const props = hddtGetUserProperties();
  if (input.username) props.setProperty(HDDT_PROP_KEYS.USERNAME, String(input.username));
  if (Object.prototype.hasOwnProperty.call(input || {}, "password")) {
    if (input.password) {
      props.setProperty(HDDT_PROP_KEYS.PASSWORD_B64, hddtEncodeSecret(String(input.password)));
    } else {
      props.deleteProperty(HDDT_PROP_KEYS.PASSWORD_B64);
    }
  }
  if (input.mst) props.setProperty(HDDT_PROP_KEYS.MST, String(input.mst));
  return true;
}

function hddtClearSession() {
  const props = hddtGetUserProperties();
  props.deleteProperty(HDDT_PROP_KEYS.TOKEN);
  props.deleteProperty(HDDT_PROP_KEYS.TOKEN_MST);
  props.deleteProperty(HDDT_PROP_KEYS.TOKEN_EXPIRES_AT);
  props.deleteProperty(HDDT_PROP_KEYS.LAST_LOGIN_AT);
  return true;
}

function hddtGetSession() {
  const props = hddtGetUserProperties();
  const creds = hddtGetCredentials();
  const token = props.getProperty(HDDT_PROP_KEYS.TOKEN) || "";
  const tokenMst = props.getProperty(HDDT_PROP_KEYS.TOKEN_MST) || "";
  const currentMst = String(creds.mst || "");
  const expiresAt = Number(props.getProperty(HDDT_PROP_KEYS.TOKEN_EXPIRES_AT) || 0);
  const mstMatched = !tokenMst || !currentMst || tokenMst === currentMst;
  return {
    token,
    tokenMst,
    currentMst,
    expiresAt,
    isValid: Boolean(token) && expiresAt > Date.now() + 5000 && mstMatched,
    reason: mstMatched ? "" : `MST phiên (${tokenMst}) khác MST cấu hình (${currentMst})`,
    lastLoginAt: props.getProperty(HDDT_PROP_KEYS.LAST_LOGIN_AT) || "",
  };
}

function hddtSaveSession(token, expiresAt) {
  const props = hddtGetUserProperties();
  const creds = hddtGetCredentials();
  props.setProperty(HDDT_PROP_KEYS.TOKEN, token);
  props.setProperty(HDDT_PROP_KEYS.TOKEN_MST, String(creds.mst || ""));
  props.setProperty(HDDT_PROP_KEYS.TOKEN_EXPIRES_AT, String(expiresAt));
  props.setProperty(HDDT_PROP_KEYS.LAST_LOGIN_AT, hddtNowIso());
}

function hddtGetConfigSummary() {
  const creds = hddtGetCredentials();
  const session = hddtGetSession();
  return {
    username: creds.username || "",
    mst: creds.mst || "",
    hasPassword: Boolean(creds.password),
    session,
  };
}

function hddtEnsureAllSheets() {
  hddtGetOrCreateSheet(HDDT_SHEETS.SUMMARY, HDDT_HEADERS.summary);
  hddtGetOrCreateSheet(HDDT_SHEETS.DETAIL, HDDT_HEADERS.detail);
  hddtGetOrCreateSheet(HDDT_SHEETS.DETAIL_LINE, HDDT_HEADERS.detailLine);
  hddtGetOrCreateSheet(HDDT_SHEETS.SYNC_RUN, HDDT_HEADERS.syncRun);
  hddtGetOrCreateSheet(HDDT_SHEETS.LOG, HDDT_HEADERS.log);
  return true;
}

function hddtGetSummarySheetByCategory(category) {
  return HDDT_SHEETS.SUMMARY;
}

function hddtGetDetailSheetByCategory(category) {
  return HDDT_SHEETS.DETAIL;
}
