/** Minimal bound-Google-Sheets interface for the HDDT downloader. */
function hddtPrepareSheets() {
  hddtEnsureAllSheets();
  SpreadsheetApp.getActive().toast(
    "Đã sẵn sàng 4 sheet xem dữ liệu: bảng kê và chi tiết mua vào/bán ra.",
    "Hóa đơn điện tử",
    5,
  );
  return { ok: true };
}

function hddtShowDialog() {
  hddtEnsureAllSheets();
  const output = HtmlService.createHtmlOutputFromFile("HddtDialogCompiled")
    .setWidth(760)
    .setHeight(640);
  SpreadsheetApp.getUi().showModalDialog(output, "Tải hóa đơn điện tử");
}

function hddtUiGetState() {
  hddtEnsureAllSheets();
  const config = hddtGetConfigSummary();
  return {
    username: config.username || "",
    mst: config.mst || "",
    session: { isValid: Boolean(config.session && config.session.isValid) },
    today: Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      "yyyy-MM-dd",
    ),
    // UrlFetchApp cannot reach the GDT host from Apps Script (see the
    // hddtUiGetCaptcha execution errors). The HTML-service iframe can reach
    // this CORS-enabled endpoint directly; this exposes no credential/session.
    apiBaseUrl: hddtGetApiBaseUrl(),
    captchaEndpoint: `${hddtGetApiBaseUrl()}/captcha`,
    authEndpoint: `${hddtGetApiBaseUrl()}/security-taxpayer/authenticate`,
  };
}

function hddtUiGetCaptcha() {
  return hddtGetCaptcha();
}

function hddtUiLogin(input) {
  const result = hddtLogin(input || {});
  return { ok: true, message: result.message || "Đăng nhập thành công." };
}

// The GDT host is unreachable from UrlFetchApp but permits the HTML-service
// iframe origin. The browser performs authentication; Apps Script receives
// only the resulting short-lived bearer token, never the password or captcha.
function hddtUiSaveBrowserLogin(input) {
  const data = input || {};
  const username = String(data.username || "").trim();
  const mst = String(data.mst || "").trim();
  const token = String(data.token || "").trim();
  if (!username || !token)
    throw new Error("Thiếu username hoặc token đăng nhập HĐĐT.");

  hddtSaveCredentials({ username, password: null, mst });
  const expiresAt = Date.now() + HDDT_DEFAULTS.TOKEN_TTL_MS;
  hddtSaveSession(token, expiresAt);
  hddtLog("INFO", "browserLogin", "Đăng nhập thành công qua trình duyệt", {
    username,
    mst,
  });
  return { ok: true, message: "Đăng nhập thành công.", expiresAt };
}

function hddtUiImportSummaryExcel(input) {
  hddtAssertLicense("syncSummary");
  const data = input || {};
  const category = String(data.category || "").trim();
  const ttxly = Number(data.ttxly || 0);
  const fromDate = String(data.fromDate || "").trim();
  const toDate = String(data.toDate || "").trim();
  const base64 = String(data.base64 || "").trim();
  if (!base64) throw new Error("Không nhận được file Excel từ HDDT.");
  if (
    (category === "purchase" && [5, 6, 8].indexOf(ttxly) < 0) ||
    (category === "sold" && [5, 8].indexOf(ttxly) < 0)
  ) {
    throw new Error("Loại hóa đơn hoặc trạng thái xử lý không hợp lệ.");
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000))
    throw new Error("Hệ thống đang bận. Vui lòng thử lại sau vài giây.");
  try {
    hddtEnsureAllSheets();
    const blob = Utilities.newBlob(
      Utilities.base64Decode(base64),
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      `hddt-${category}-${ttxly}-${fromDate}-${toDate}.xlsx`,
    );
    const result = hddtImportSummaryExcelBlob(blob, {
      category,
      ttxly,
      fromDate,
      toDate,
    });
    hddtLog(
      "INFO",
      "browserSummaryImport",
      "Đã nhập bảng kê Excel tải từ trình duyệt",
      result,
    );
    return result;
  } catch (error) {
    hddtLog(
      "ERROR",
      "browserSummaryImport",
      String(error && error.message ? error.message : error),
    );
    throw error;
  } finally {
    lock.releaseLock();
  }
}

function hddtUiGetPendingDetails(input) {
  hddtAssertLicense("syncDetail");
  const data = input || {};
  const category = String(data.category || "").trim();
  const dateRange = data.dateRange || {};
  const maxInvoices = Math.max(
    1,
    Math.min(200, Number(data.maxInvoices) || 50),
  );
  if (category !== "purchase" && category !== "sold")
    throw new Error("Loại hóa đơn không hợp lệ.");
  hddtMonthChunks(String(dateRange.from || ""), String(dateRange.to || ""));

  hddtEnsureAllSheets();
  const ttxlySet = new Set(
    (category === "purchase" ? [5, 6, 8] : [5, 8]).map(String),
  );
  return hddtReadSheetObjects(hddtGetSummarySheetByCategory(category), HDDT_HEADERS.summary)
    .filter((row) => ttxlySet.has(String(row.ttxly)))
    .filter((row) => hddtDetailDateMatches(row.invoiceDate, dateRange))
    .filter((row) => !String(row.detailFetchedAt || "").trim())
    .slice(0, maxInvoices)
    .map((row) => ({
      summaryKey: String(row.summaryKey || ""),
      invoiceKey: String(row.invoiceKey || ""),
      category,
      ttxly: Number(row.ttxly || 0),
      formSymbol: hddtToIdText(row.formSymbol),
      invoiceSymbol: hddtToIdText(row.invoiceSymbol),
      invoiceNumber: hddtToIdText(row.invoiceNumber),
      sellerTaxCode: hddtToIdText(row.sellerTaxCode),
    }));
}

function hddtUiImportDetailPayload(input) {
  hddtAssertLicense("syncDetail");
  const data = input || {};
  const invoice = data.invoice || {};
  const category = String(invoice.category || "").trim();
  const ttxly = Number(invoice.ttxly || 0);
  const summaryKey = String(invoice.summaryKey || "").trim();
  const invoiceKey = String(invoice.invoiceKey || "").trim();
  if (
    (category !== "purchase" && category !== "sold") ||
    [5, 6, 8].indexOf(ttxly) < 0 ||
    !summaryKey ||
    !invoiceKey
  ) {
    throw new Error("Dữ liệu hóa đơn chi tiết không hợp lệ.");
  }
  let payload;
  try {
    payload =
      typeof data.payload === "string"
        ? JSON.parse(data.payload)
        : data.payload;
  } catch (_error) {
    throw new Error("Phản hồi chi tiết từ HDDT không phải JSON hợp lệ.");
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000))
    throw new Error("Hệ thống đang bận. Vui lòng thử lại sau vài giây.");
  try {
    hddtEnsureAllSheets();
    const summary = hddtReadExistingRowsByKey(
      hddtGetSummarySheetByCategory(category),
      HDDT_HEADERS.summary,
      "summaryKey"
    )[summaryKey];
    if (!summary) throw new Error("Không tìm thấy hóa đơn gốc để lưu chi tiết.");
    const lines = hddtExtractDetailLines(payload);
    const lineResult = hddtUpsertRows(
      hddtGetDetailSheetByCategory(category),
      HDDT_HEADERS.detailLine,
      "lineKey",
      lines.map((line) => hddtEtaxMapDetailLine(line, summary)),
    );
    hddtMarkSummaryDetailFetched(category, summaryKey, lines.length);
    return {
      ok: true,
      fetchedInvoices: 1,
      lines: lines.length,
      inserted: lineResult.inserted,
      updated: lineResult.updated,
    };
  } finally {
    lock.releaseLock();
  }
}

function hddtUiSync(input) {
  const data = input || {};
  const dateRange = data.dateRange || {};
  if (!dateRange.from || !dateRange.to)
    throw new Error("Hãy chọn ngày bắt đầu và kết thúc.");
  hddtMonthChunks(dateRange.from, dateRange.to);

  const maxInvoices = Math.max(
    1,
    Math.min(200, Number(data.maxInvoices) || 50),
  );
  const includeDetails = Boolean(data.includeDetails);
  const tasks = [];
  if (data.purchase) {
    tasks.push({
      label: "Hóa đơn mua vào",
      run: () => {
        const summary = hddtSyncSummary({
          category: "purchase",
          ttxly: "all",
          tthai: 0,
          dateRange,
        });
        const detail = includeDetails
          ? hddtSyncDetail({
              category: "purchase",
              ttxly: "all",
              dateRange,
              maxInvoices,
            })
          : null;
        return {
          summary,
          detail,
          fetched: summary.fetched,
          fetchedInvoices: detail ? detail.fetchedInvoices : 0,
        };
      },
    });
  }
  if (data.sold) {
    tasks.push({
      label: "Hóa đơn bán ra",
      run: () => {
        const summary = hddtSyncSummary({
          category: "sold",
          ttxly: "all",
          tthai: 0,
          dateRange,
        });
        const detail = includeDetails
          ? hddtSyncDetail({
              category: "sold",
              ttxly: "all",
              dateRange,
              maxInvoices,
            })
          : null;
        return {
          summary,
          detail,
          fetched: summary.fetched,
          fetchedInvoices: detail ? detail.fetchedInvoices : 0,
        };
      },
    });
  }
  if (!tasks.length)
    throw new Error("Hãy chọn ít nhất một loại dữ liệu để tải.");
  const run = hddtEtaxCreateSyncRun({
    category: tasks.length === 2 ? "all" : data.purchase ? "purchase" : "sold",
    fromDate: dateRange.from,
    toDate: dateRange.to,
    includeDetails,
  });

  const results = [];
  const errors = [];
  tasks.forEach((task) => {
    try {
      results.push({ label: task.label, result: task.run() });
    } catch (error) {
      errors.push({
        label: task.label,
        message: String(error && error.message ? error.message : error),
      });
    }
  });
  const outcome = {
    ok: errors.length === 0,
    results,
    errors,
    dateRange,
    maxInvoices,
    includeDetails,
  };
  outcome.syncRun = hddtEtaxFinishSyncRun(run, outcome);
  hddtLog(
    outcome.ok ? "INFO" : "WARN",
    "boundSync",
    outcome.ok ? "Tải dữ liệu hoàn tất" : "Tải dữ liệu hoàn tất nhưng có lỗi",
    outcome,
  );
  return outcome;
}

function hddtMigrateToEtaxSchema() {
  hddtEnsureAllSheets();
  return { ok: true };
}
