const HDDT_SHEETS = {
  PURCHASE_SUMMARY: "Bảng kê mua vào",
  SOLD_SUMMARY: "Bảng kê bán ra",
  PURCHASE_DETAIL: "Chi tiết mua vào",
  SOLD_DETAIL: "Chi tiết bán ra",
  SYNC_RUN: "HDDT_Dong_bo",
  LOG: "HDDT_Nhat_ky",
};

const HDDT_HEADERS = {
  summary: [
    "invoiceDate",
    "formSymbol",
    "invoiceSymbol",
    "invoiceNumber",
    "counterpartyTaxCode",
    "counterpartyName",
    "totalBeforeTax",
    "totalTax",
    "totalDiscount",
    "totalPayment",
    "currency",
    "invoiceStatus",
    "checkResult",
    "counterpartyIsHighRisk",
    "summaryKey",
    "invoiceKey",
    "ttxly",
    "detailFetchedAt",
    "detailLineCount",
    "sellerTaxCode",
    "updatedAt",
  ],
  detailLine: [
    "invoiceDate",
    "invoiceReference",
    "counterpartyTaxCode",
    "counterpartyName",
    "stt",
    "ten",
    "dvtinh",
    "sluong",
    "dgia",
    "stckhau",
    "tsuat",
    "thtien",
    "tthue",
    "lineKey",
    "summaryKey",
    "lineNature",
    "signedAmount",
    "signedTaxAmount",
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

const HDDT_HEADER_LABELS = {
  invoiceDate: "Ngày lập",
  formSymbol: "Mẫu số",
  invoiceSymbol: "Ký hiệu",
  invoiceNumber: "Số hóa đơn",
  counterpartyTaxCode: "MST đối tác",
  counterpartyName: "Tên đối tác",
  totalBeforeTax: "Tiền trước thuế",
  totalTax: "Thuế GTGT",
  totalDiscount: "Chiết khấu",
  totalPayment: "Tổng thanh toán",
  currency: "Loại tiền",
  invoiceStatus: "Trạng thái hóa đơn",
  checkResult: "Kết quả kiểm tra",
  counterpartyIsHighRisk: "Cảnh báo đối tác",
  invoiceReference: "Hóa đơn",
  stt: "STT dòng",
  ten: "Tên hàng hóa/dịch vụ",
  dvtinh: "Đơn vị tính",
  sluong: "Số lượng",
  dgia: "Đơn giá",
  stckhau: "Chiết khấu",
  tsuat: "Thuế suất",
  thtien: "Tiền trước thuế",
  tthue: "Tiền thuế",
  summaryKey: "Mã liên kết hóa đơn",
  invoiceKey: "Mã hóa đơn nguồn",
  ttxly: "Mã trạng thái xử lý",
  detailFetchedAt: "Đã tải chi tiết lúc",
  detailLineCount: "Số dòng chi tiết",
  sellerTaxCode: "MST người bán nguồn",
  updatedAt: "Cập nhật lúc",
  lineKey: "Mã dòng",
  lineNature: "Loại dòng",
  signedAmount: "Tiền trước thuế đã chuẩn hóa",
  signedTaxAmount: "Tiền thuế đã chuẩn hóa",
};

const HDDT_READER_SHEET_CONFIG = {
  [HDDT_SHEETS.PURCHASE_SUMMARY]: {
    headers: HDDT_HEADERS.summary,
    hiddenHeaders: ["summaryKey", "invoiceKey", "ttxly", "detailFetchedAt", "detailLineCount", "sellerTaxCode", "updatedAt"],
    tabColor: "#2E7D32",
  },
  [HDDT_SHEETS.SOLD_SUMMARY]: {
    headers: HDDT_HEADERS.summary,
    hiddenHeaders: ["summaryKey", "invoiceKey", "ttxly", "detailFetchedAt", "detailLineCount", "sellerTaxCode", "updatedAt"],
    tabColor: "#1565C0",
  },
  [HDDT_SHEETS.PURCHASE_DETAIL]: {
    headers: HDDT_HEADERS.detailLine,
    hiddenHeaders: ["lineKey", "summaryKey", "lineNature", "signedAmount", "signedTaxAmount", "updatedAt"],
    tabColor: "#66BB6A",
  },
  [HDDT_SHEETS.SOLD_DETAIL]: {
    headers: HDDT_HEADERS.detailLine,
    hiddenHeaders: ["lineKey", "summaryKey", "lineNature", "signedAmount", "signedTaxAmount", "updatedAt"],
    tabColor: "#42A5F5",
  },
};

const HDDT_LEGACY_SHEETS = {
  SUMMARY: "HDDT_Hoa_don",
  DETAIL: "HDDT_Chi_tiet",
  DETAIL_LINE: "HDDT_Dong_hang",
};

const HDDT_LEGACY_HEADERS = {
  summary: [
    "summaryKey", "invoiceKey", "category", "ttxly", "fromDate", "toDate", "monthLabel", "downloadMonth", "stt", "formSymbol", "invoiceSymbol", "invoiceNumber", "invoiceDate", "sellerTaxCode", "sellerName", "sellerAddress", "buyerTaxCode", "buyerName", "buyerAddress", "buyerIdNo", "totalBeforeTax", "totalTax", "totalDiscount", "totalFee", "totalPayment", "counterpartyTaxCode", "counterpartyStatusCode", "counterpartyStatusText", "counterpartyIsHighRisk", "currency", "exchangeRate", "invoiceStatus", "checkResult", "sourceHeaders", "raw", "createdAt", "updatedAt",
  ],
  detail: ["detailKey", "summaryKey", "invoiceKey", "category", "ttxly", "payload", "lineCount", "fetchedAt", "updatedAt"],
  detailLine: ["lineKey", "detailKey", "summaryKey", "invoiceKey", "category", "ttxly", "stt", "tchat", "loaiHangHoaDacTrung", "ten", "dvtinh", "sluong", "dgia", "stckhau", "tsuat", "thtien", "tthue", "lineNature", "signedAmount", "signedTaxAmount", "raw", "updatedAt"],
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
  Object.keys(HDDT_READER_SHEET_CONFIG).forEach((sheetName) => {
    const config = HDDT_READER_SHEET_CONFIG[sheetName];
    const sheet = hddtGetOrCreateSheet(sheetName, config.headers);
    sheet.showSheet();
    hddtConfigureReaderSheet(sheet, config);
    hddtTrimUnusedRows(sheet, 100);
  });

  const syncRunSheet = hddtGetOrCreateSheet(HDDT_SHEETS.SYNC_RUN, HDDT_HEADERS.syncRun);
  const logSheet = hddtGetOrCreateSheet(HDDT_SHEETS.LOG, HDDT_HEADERS.log);
  hddtTrimUnusedRows(syncRunSheet, 50);
  hddtTrimUnusedRows(logSheet, 100);
  syncRunSheet.hideSheet();
  logSheet.hideSheet();
  hddtMigrateLegacySheetsIfNeeded();
  hddtRemoveEmptyDefaultSheets();
  return true;
}

function hddtRemoveEmptyDefaultSheets() {
  const ss = getDatabaseSpreadsheet();
  ss.getSheets().forEach((sheet) => {
    const name = sheet.getName();
    const isDefaultSheet = /^(Sheet|Trang tính)\d*$/.test(name);
    if (!isDefaultSheet || sheet.getLastRow() > 0) return;
    if (ss.getSheets().length > 1) ss.deleteSheet(sheet);
  });
}

function hddtGetSummarySheetByCategory(category) {
  return category === "purchase"
    ? HDDT_SHEETS.PURCHASE_SUMMARY
    : HDDT_SHEETS.SOLD_SUMMARY;
}

function hddtGetDetailSheetByCategory(category) {
  return category === "purchase"
    ? HDDT_SHEETS.PURCHASE_DETAIL
    : HDDT_SHEETS.SOLD_DETAIL;
}
