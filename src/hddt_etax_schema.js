/**
 * Canonical HDDT schema ported from etax-manager.  It keeps a unified invoice
 * table, raw detail payloads, normalized detail lines, and a resumable run log.
 */
function hddtEtaxNormalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "");
}

function hddtEtaxText(value) {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  return text || "";
}

function hddtEtaxPick(record, aliases) {
  const keys = Object.keys(record || {});
  for (let i = 0; i < aliases.length; i++) {
    const target = hddtEtaxNormalizeText(aliases[i]);
    for (let j = 0; j < keys.length; j++) {
      if (hddtEtaxNormalizeText(keys[j]) !== target) continue;
      const value = record[keys[j]];
      if (value !== null && value !== undefined && String(value).trim() !== "") return value;
    }
  }
  return "";
}

function hddtEtaxNumber(value) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = String(value).trim().replace(/\s+/g, "");
  if (!raw) return "";
  const hasDot = raw.indexOf(".") >= 0;
  const hasComma = raw.indexOf(",") >= 0;
  let normalized = raw;
  if (hasDot && hasComma) {
    normalized = raw.lastIndexOf(".") > raw.lastIndexOf(",") ? raw.replace(/,/g, "") : raw.replace(/\./g, "").replace(/,/g, ".");
  } else if (hasComma) {
    const parts = raw.split(",");
    normalized = parts.length > 2 || /^\d{3}$/.test(parts[parts.length - 1]) ? raw.replace(/,/g, "") : raw.replace(/,/g, ".");
  } else if (hasDot) {
    const parts = raw.split(".");
    normalized = parts.length > 2 || /^\d{3}$/.test(parts[parts.length - 1]) ? raw.replace(/\./g, "") : raw;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : "";
}

function hddtEtaxDate(value) {
  if (Object.prototype.toString.call(value) === "[object Date]" && Number.isFinite(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  const text = hddtEtaxText(value);
  const dmy = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmy) return `${dmy[3]}-${String(dmy[2]).padStart(2, "0")}-${String(dmy[1]).padStart(2, "0")}`;
  const parsed = new Date(text);
  return Number.isFinite(parsed.getTime()) ? Utilities.formatDate(parsed, Session.getScriptTimeZone(), "yyyy-MM-dd") : "";
}

function hddtEtaxMonthLabel(ymd) {
  const match = String(ymd || "").match(/^(\d{4})-(\d{2})/);
  return match ? `${match[2]}/${match[1]}` : "";
}

function hddtEtaxParseWorkbookRows(matrix) {
  const rows = Array.isArray(matrix) ? matrix : [];
  const headerIndex = rows.findIndex((row) => {
    const fields = (Array.isArray(row) ? row : []).map(hddtEtaxNormalizeText);
    // Keep this in sync with etax-manager's parseWorkbookRows():
    // hddtEtaxNormalizeText removes spaces and diacritics, so
    // "Số hóa đơn" becomes "sohoadon" (not "so hoa don").
    return fields.indexOf("stt") >= 0 && fields.indexOf("sohoadon") >= 0;
  });
  if (headerIndex < 0) throw new Error("Không tìm thấy dòng tiêu đề bảng kê HDDT trong file Excel.");
  const headers = rows[headerIndex].map((value, index) => hddtEtaxText(value) || `COLUMN_${index + 1}`);
  const records = rows.slice(headerIndex + 1).map((row) => {
    const record = {};
    headers.forEach((header, index) => { record[header] = Array.isArray(row) ? row[index] : ""; });
    return record;
  }).filter((row) => {
    return Boolean(hddtEtaxText(hddtEtaxPick(row, ["Số hóa đơn", "Số HĐ", "SoHD"])) ||
      hddtEtaxText(hddtEtaxPick(row, ["MST người bán", "MST người xuất hàng"])) ||
      hddtEtaxText(hddtEtaxPick(row, ["MST người mua", "MST người nhận hàng"])));
  });
  return { headers, records };
}

function hddtEtaxCounterpartyStatus(taxCode, checkResult) {
  const tax = String(taxCode || "").replace(/\s+/g, "");
  const check = hddtEtaxText(checkResult);
  const normalized = hddtEtaxNormalizeText(check);
  const risk = /rui ro|ngung hoat dong|bo dia chi|khong hoat dong|canh bao|khong ton tai/.test(normalized);
  if (!tax) return { code: "NO_TAX_CODE", text: "Không có MST", risk: false };
  if (!/^\d{10}(-?\d{3})?$/.test(tax)) return { code: "INVALID_TAX_CODE", text: "Mã số thuế đối tác không đúng định dạng.", risk: true };
  return { code: risk ? "RISK" : "OK", text: check || (risk ? "Đối tác có cảnh báo rủi ro." : "Đối tác chưa thấy tín hiệu rủi ro."), risk };
}

function hddtEtaxMapSummary(record, meta, headers) {
  const formSymbol = hddtEtaxText(hddtEtaxPick(record, ["Ký hiệu mẫu số", "Mẫu số"]));
  const invoiceSymbol = hddtEtaxText(hddtEtaxPick(record, ["Ký hiệu hóa đơn", "Ký hiệu"]));
  const invoiceNumber = hddtEtaxText(hddtEtaxPick(record, ["Số hóa đơn", "Số HĐ", "SoHD"]));
  const sellerTaxCode = hddtEtaxText(hddtEtaxPick(record, ["MST người bán/MST người xuất hàng", "MST người bán", "MST người xuất hàng"]));
  const buyerTaxCode = hddtEtaxText(hddtEtaxPick(record, ["MST người mua/MST người nhận hàng", "MST người mua", "MST người nhận hàng"]));
  const invoiceDate = hddtEtaxDate(hddtEtaxPick(record, ["Ngày lập", "Ngay lap"]));
  const monthLabel = hddtEtaxMonthLabel(invoiceDate) || hddtEtaxMonthLabel(meta.fromDate);
  const invoiceKey = [sellerTaxCode || "unknown", formSymbol || "unknown", invoiceNumber || "unknown", invoiceSymbol || "unknown"].join("|");
  const summaryKey = [meta.category, meta.ttxly, invoiceKey, monthLabel || "unknown"].join("|");
  const checkResult = hddtEtaxText(hddtEtaxPick(record, ["Kết quả kiểm tra hóa đơn", "Kết quả kiểm tra"]));
  const counterpartyTaxCode = meta.category === "purchase" ? sellerTaxCode : buyerTaxCode;
  const counterpartyName = meta.category === "purchase"
    ? hddtEtaxText(hddtEtaxPick(record, ["Tên người bán/Tên người xuất hàng", "Tên người bán", "Tên người xuất hàng"]))
    : hddtEtaxText(hddtEtaxPick(record, ["Tên người mua/Tên người nhận hàng", "Tên người mua", "Tên người nhận hàng"]));
  const counterparty = hddtEtaxCounterpartyStatus(counterpartyTaxCode, checkResult);
  const now = hddtNowIso();
  return {
    category: meta.category,
    invoiceDate, formSymbol, invoiceSymbol, invoiceNumber, counterpartyTaxCode, counterpartyName,
    totalBeforeTax: hddtEtaxNumber(hddtEtaxPick(record, ["Tổng tiền chưa thuế", "Tổng tiền hàng", "Tiền hàng", "Tổng tiền chưa có thuế GTGT", "Tổng tiền hàng hoá dịch vụ"])),
    totalTax: hddtEtaxNumber(hddtEtaxPick(record, ["Tổng tiền thuế", "Tổng tiền thuế GTGT", "Tổng GTGT", "Tiền thuế GTGT", "Thuế GTGT", "GTGT"])),
    totalDiscount: hddtEtaxNumber(hddtEtaxPick(record, ["Tổng tiền chiết khấu thương mại"])),
    totalPayment: hddtEtaxNumber(hddtEtaxPick(record, ["Tổng tiền thanh toán"])),
    currency: hddtEtaxText(hddtEtaxPick(record, ["Đơn vị tiền tệ"])),
    invoiceStatus: hddtEtaxText(hddtEtaxPick(record, ["Trạng thái hóa đơn"])),
    checkResult, counterpartyIsHighRisk: counterparty.risk ? "Có" : "",
    summaryKey, invoiceKey, ttxly: meta.ttxly, detailFetchedAt: "", detailLineCount: "", sellerTaxCode, updatedAt: now,
  };
}

function hddtEtaxLineNature(tchat, name) {
  const normalized = hddtEtaxNormalizeText(name);
  if (Number(tchat) === 3 || /chiet khau|giam gia|giam tru|khuyen mai/.test(normalized)) return "DISCOUNT";
  if (/dieu chinh|hang tra lai|tra lai hang/.test(normalized)) return "ADJUSTMENT";
  return Number(tchat || 1) === 1 ? "NORMAL" : "OTHER";
}

function hddtEtaxMapDetailLine(line, detail) {
  const stt = hddtEtaxNumber(hddtExtractField(line, ["stt", "lineNo", "soThuTu", "index"])) || 0;
  const ten = hddtEtaxText(hddtExtractField(line, ["ten", "itemName", "tenHHDVu", "name"]));
  const tchat = hddtEtaxNumber(hddtExtractField(line, ["tchat"]));
  const thtien = hddtEtaxNumber(hddtExtractField(line, ["thtien", "amountBeforeTax", "thanhTien"]));
  const tthue = hddtEtaxNumber(hddtExtractField(line, ["tthue", "vatAmount", "tienThue"]));
  const nature = hddtEtaxLineNature(tchat, ten);
  const sign = nature === "DISCOUNT" ? -1 : 1;
  const rate = hddtEtaxNumber(hddtExtractField(line, ["tsuat", "vatRate", "thueSuat"]));
  const computedTax = tthue !== "" ? tthue : (thtien !== "" && rate !== "" ? Math.round(Math.abs(thtien) * (rate > 1 ? rate : rate * 100) / 100) : "");
  const stable = stt || Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, `${ten}|${thtien}|${rate}`)).slice(0, 12);
  return {
    invoiceDate: detail.invoiceDate,
    invoiceReference: hddtBuildInvoiceReference(detail),
    counterpartyTaxCode: detail.counterpartyTaxCode,
    counterpartyName: detail.counterpartyName,
    stt, ten,
    dvtinh: hddtEtaxText(hddtExtractField(line, ["dvtinh", "unit", "donViTinh"])), sluong: hddtEtaxNumber(hddtExtractField(line, ["sluong", "quantity", "soLuong"])),
    dgia: hddtEtaxNumber(hddtExtractField(line, ["dgia", "unitPrice", "donGia"])), stckhau: hddtEtaxNumber(hddtExtractField(line, ["stckhau", "discountAmount"])),
    tsuat: rate, thtien, tthue: computedTax,
    lineKey: `${detail.summaryKey}|${stable}`, summaryKey: detail.summaryKey,
    lineNature: nature, signedAmount: thtien === "" ? "" : Math.abs(thtien) * sign, signedTaxAmount: computedTax === "" ? "" : Math.abs(computedTax) * sign,
    updatedAt: hddtNowIso(),
  };
}

function hddtEtaxCreateSyncRun(input) {
  const syncRunId = Utilities.getUuid();
  const row = { syncRunId, startedAt: hddtNowIso(), finishedAt: "", category: input.category || "all", fromDate: input.fromDate, toDate: input.toDate, includeDetails: input.includeDetails ? "TRUE" : "FALSE", status: "RUNNING", currentStep: "Đang tải dữ liệu HDDT", summaryTotal: 0, summaryDone: 0, summaryFailed: 0, detailTotal: 0, detailDone: 0, errorMessage: "" };
  hddtUpsertRows(HDDT_SHEETS.SYNC_RUN, HDDT_HEADERS.syncRun, "syncRunId", [row]);
  return row;
}

function hddtEtaxFinishSyncRun(run, outcome) {
  const summary = (outcome.results || []).reduce((total, item) => total + Number(item.result && item.result.fetched || 0), 0);
  const detail = (outcome.results || []).reduce((total, item) => total + Number(item.result && item.result.fetchedInvoices || 0), 0);
  const row = Object.assign({}, run, { finishedAt: hddtNowIso(), status: outcome.ok ? "SUCCEEDED" : "FAILED", currentStep: outcome.ok ? "Đồng bộ hoàn tất" : "Đồng bộ có lỗi", summaryTotal: summary, summaryDone: summary, summaryFailed: (outcome.errors || []).length, detailTotal: detail, detailDone: detail, errorMessage: (outcome.errors || []).map((item) => item.label + ": " + item.message).join(" | ") });
  hddtUpsertRows(HDDT_SHEETS.SYNC_RUN, HDDT_HEADERS.syncRun, "syncRunId", [row]);
  return row;
}

function hddtEtaxDeleteLegacySheets() {
  hddtEnsureAllSheets();
  return { ok: true };
}
