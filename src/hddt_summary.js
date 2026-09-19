function hddtParseDateYmd(input) {
  const value = String(input || "").trim();
  if (!value) throw new Error("Thiếu ngày bắt đầu/kết thúc.");
  const parts = value.split("-");
  if (parts.length !== 3) throw new Error(`Ngày không hợp lệ: ${value}`);
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}

function hddtFormatDateDmy(date) {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function hddtMonthChunks(fromYmd, toYmd) {
  const from = hddtParseDateYmd(fromYmd);
  const to = hddtParseDateYmd(toYmd);
  if (from > to) throw new Error("dateRange.from phải <= dateRange.to");

  const chunks = [];
  let cursor = new Date(from.getFullYear(), from.getMonth(), 1);

  while (cursor <= to) {
    const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);

    const chunkStart = monthStart < from ? from : monthStart;
    const chunkEnd = monthEnd > to ? to : monthEnd;

    chunks.push({
      from: Utilities.formatDate(
        chunkStart,
        Session.getScriptTimeZone(),
        "yyyy-MM-dd",
      ),
      to: Utilities.formatDate(
        chunkEnd,
        Session.getScriptTimeZone(),
        "yyyy-MM-dd",
      ),
    });

    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }

  return chunks;
}

function hddtBuildSummaryEndpoint(category, ttxly) {
  const useSco = Number(ttxly) === 8;
  if (category === "sold") {
    return useSco ? "/sco-query/invoices/sold" : "/query/invoices/sold";
  }
  return useSco ? "/sco-query/invoices/purchase" : "/query/invoices/purchase";
}

function hddtBuildSummarySearch(category, ttxly, fromYmd, toYmd) {
  const from = `${hddtFormatDateDmy(hddtParseDateYmd(fromYmd))}T00:00:00`;
  const to = `${hddtFormatDateDmy(hddtParseDateYmd(toYmd))}T23:59:59`;
  // HDDT search parser is strict; use double-equals for ttxly filter.
  const ttxlyClause = `ttxly==${ttxly}`;
  return `tdlap=ge=${from};tdlap=le=${to};${ttxlyClause}`;
}

function hddtResolveTtxlyList(rawTtxly) {
  const text = String(rawTtxly || "")
    .trim()
    .toLowerCase();
  if (!text || text === "all" || text === "*") return [5, 6, 8];
  const n = Number(text);
  if (n === 5 || n === 6 || n === 8) return [n];
  return [5];
}

function hddtNormalizeIdText(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" && Number.isFinite(value)) {
    return Utilities.formatString("%.0f", value);
  }
  return String(value).trim();
}

function hddtSummaryToTextOrEmpty(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function hddtSummaryGetMetaValue(raw, fieldNames) {
  const names = (fieldNames || []).map((x) => String(x || "").toLowerCase());
  if (!names.length) return "";
  const groups = [raw && raw.ttttkhac, raw && raw.ttkhac, raw && raw.cttkhac];

  for (let g = 0; g < groups.length; g++) {
    const list = Array.isArray(groups[g]) ? groups[g] : [];
    for (let i = 0; i < list.length; i++) {
      const item = list[i] || {};
      const key = String(
        item.ttruong || item.field || item.name || "",
      ).toLowerCase();
      if (!key || names.indexOf(key) < 0) continue;
      const value = item.dlieu !== undefined ? item.dlieu : item.value;
      if (value === undefined || value === null || value === "") continue;
      return value;
    }
  }
  return "";
}

function hddtSummarySumByFields(list, fieldNames) {
  const fields = (fieldNames || []).map((x) => String(x || "").toLowerCase());
  const rows = Array.isArray(list) ? list : [];
  let sum = 0;
  let hasValue = false;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || {};
    for (let j = 0; j < fields.length; j++) {
      const field = fields[j];
      let value = "";
      if (row[field] !== undefined) {
        value = row[field];
      } else {
        const keys = Object.keys(row);
        for (let k = 0; k < keys.length; k++) {
          if (String(keys[k] || "").toLowerCase() === field) {
            value = row[keys[k]];
            break;
          }
        }
      }
      const n = hddtToNumberOrEmpty(value);
      if (typeof n === "number") {
        sum += n;
        hasValue = true;
      }
    }
  }

  return hasValue ? sum : "";
}

function hddtSummaryPickNumber(values) {
  for (let i = 0; i < values.length; i++) {
    const n = hddtToNumberOrEmpty(values[i]);
    if (typeof n === "number") return n;
  }
  return "";
}

function hddtToNumberOrEmpty(value) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = String(value).trim();
  if (!raw) return "";

  if (/^-?\d+(\.\d+)?$/.test(raw)) {
    const n = Number(raw);
    return Number.isFinite(n) ? n : "";
  }

  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(raw)) {
    const normalized = raw.replace(/\./g, "").replace(/,/g, ".");
    const n = Number(normalized);
    return Number.isFinite(n) ? n : "";
  }

  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(raw)) {
    const normalized = raw.replace(/,/g, "");
    const n = Number(normalized);
    return Number.isFinite(n) ? n : "";
  }

  const cleaned = raw.replace(/[^0-9.\-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === "." || cleaned === "-.")
    return "";
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : "";
}

function hddtExtractList(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;

  const candidates = [
    payload.data,
    payload.result,
    payload.content,
    payload.items,
    payload.rows,
    payload.datas,
    payload.list,
  ];

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    if (Array.isArray(candidate)) return candidate;
    if (candidate && typeof candidate === "object") {
      const nested = [
        candidate.data,
        candidate.content,
        candidate.items,
        candidate.rows,
        candidate.list,
      ];
      for (let j = 0; j < nested.length; j++) {
        if (Array.isArray(nested[j])) return nested[j];
      }
    }
  }

  return [];
}

function hddtExtractState(payload) {
  if (!payload || typeof payload !== "object") return "";
  const state = hddtExtractField(payload, ["state", "nextState", "cursor"]);
  return String(state || "").trim();
}

function hddtExtractTotal(payload) {
  if (!payload || typeof payload !== "object") return 0;
  const totalRaw = hddtExtractField(payload, [
    "total",
    "totalElements",
    "count",
  ]);
  const total = Number(totalRaw || 0);
  return Number.isFinite(total) ? total : 0;
}

function hddtFetchSummaryPage(endpoint, token, query) {
  const url = `${hddtGetApiBaseUrl()}${endpoint}${hddtBuildQueryString(query)}`;
  try {
    return hddtRequestJson({
      method: "get",
      url,
      token,
      retry: { retries: 3, backoffMs: 500 },
    });
  } catch (error) {
    const message = String(
      error && error.message ? error.message : error || "",
    );
    const sortValue = String((query && query.sort) || "");
    const hasMultiSort = sortValue.indexOf(",") >= 0;
    const notSupportMultiSort =
      message.indexOf("Không hỗ trợ sắp xếp theo nhiều trường") >= 0 ||
      message.toLowerCase().indexOf("multiple sort") >= 0;

    if (hasMultiSort && notSupportMultiSort) {
      const fallbackQuery = Object.assign({}, query, { sort: "tdlap:desc" });
      const fallbackUrl = `${hddtGetApiBaseUrl()}${endpoint}${hddtBuildQueryString(fallbackQuery)}`;
      return hddtRequestJson({
        method: "get",
        url: fallbackUrl,
        token,
        retry: { retries: 3, backoffMs: 500 },
      });
    }

    throw error;
  }
}

function hddtBuildSummaryExcelEndpoint(category, ttxly) {
  const useSco = Number(ttxly) === 8;
  if (category === "sold") {
    return useSco
      ? "/sco-query/invoices/export-excel"
      : "/query/invoices/export-excel";
  }
  // GDT's purchase export has the historical but verified "-sold" endpoint name.
  return useSco
    ? "/sco-query/invoices/export-excel-sold"
    : "/query/invoices/export-excel-sold";
}

function hddtBuildSummaryExcelSearch(category, ttxly, fromYmd, toYmd) {
  const from = `${hddtFormatDateDmy(hddtParseDateYmd(fromYmd))}T00:00:00`;
  const to = `${hddtFormatDateDmy(hddtParseDateYmd(toYmd))}T23:59:59`;
  const base = `tdlap=ge=${from};tdlap=le=${to}`;
  if (category === "purchase") {
    return `${base};ttxly==${ttxly}`;
  }
  return base;
}

function hddtBuildSummaryExcelQuery(category, ttxly, chunk, tthai) {
  const query = {
    search: hddtBuildSummaryExcelSearch(category, ttxly, chunk.from, chunk.to),
    sort: "tdlap:desc,khmshdon:asc,shdon:desc",
  };
  const isPosSold = category === "sold" && Number(ttxly) === 8;
  if (!isPosSold) {
    query.size = HDDT_DEFAULTS.PAGE_SIZE;
  }
  if (category === "purchase") {
    query.type = "purchase";
  }
  if (Number(tthai) > 0) {
    query.tthai = Number(tthai);
  }
  return query;
}

function hddtFetchSummaryExcelBlob(endpoint, token, query) {
  const url = `${hddtGetApiBaseUrl()}${endpoint}${hddtBuildQueryString(query)}`;
  const response = hddtFetchWithRetry(
    url,
    {
      method: "get",
      headers: hddtGetDefaultHeaders(token),
      muteHttpExceptions: true,
      followRedirects: true,
    },
    { retries: 3, backoffMs: 500 },
  );

  const statusCode = response.getResponseCode();
  if (statusCode >= 400) {
    throw new Error(`HTTP ${statusCode}: Không tải được file bảng kê Excel`);
  }
  return response.getBlob();
}

// The GDT API is reachable from the HTML-service browser iframe but can reject
// UrlFetchApp at the network layer with "Address unavailable". Keep all Excel
// parsing and Sheet writes server-side; this helper accepts only the workbook
// already obtained by the browser with a short-lived bearer token.
function hddtImportSummaryExcelBlob(blob, input) {
  const data = input || {};
  const category = String(data.category || "").trim();
  const ttxly = Number(data.ttxly || 0);
  const fromDate = String(data.fromDate || "").trim();
  const toDate = String(data.toDate || "").trim();
  if (category !== "purchase" && category !== "sold")
    throw new Error("Loại hóa đơn không hợp lệ.");
  if ([5, 6, 8].indexOf(ttxly) < 0) throw new Error("ttxly không hợp lệ.");
  hddtMonthChunks(fromDate, toDate);

  const excelRows = hddtConvertExcelBlobToRows(
    blob,
    `hddt-${category}-${ttxly}-${fromDate}-${toDate}.xlsx`,
  );
  const parsed = hddtEtaxParseWorkbookRows(excelRows || []);
  const normalized = parsed.records.map((row) =>
    hddtEtaxMapSummary(
      row,
      {
        category,
        ttxly,
        fromDate,
        toDate,
      },
      parsed.headers,
    ),
  );
  const upsertResult = hddtUpsertRows(
    HDDT_SHEETS.SUMMARY,
    HDDT_HEADERS.summary,
    "summaryKey",
    normalized,
  );
  return {
    ok: true,
    category,
    ttxly,
    fromDate,
    toDate,
    fetched: normalized.length,
    inserted: upsertResult.inserted,
    updated: upsertResult.updated,
    source: "browser_excel_export",
  };
}

function hddtConvertExcelBlobToRows(blob, fileName) {
  if (typeof Drive === "undefined" || !Drive.Files || !Drive.Files.copy) {
    throw new Error(
      "Apps Script chưa bật Advanced Drive Service (Drive API v2). Hãy bật để đồng bộ theo file Excel GDT.",
    );
  }

  const source = DriveApp.createFile(blob.setName(fileName));
  let convertedId = "";
  try {
    const converted = Drive.Files.copy(
      {
        title: `${fileName}-tmp-gsheet`,
        mimeType: MimeType.GOOGLE_SHEETS,
      },
      source.getId(),
    );
    convertedId = converted.id;
    const ss = SpreadsheetApp.openById(convertedId);
    const firstSheet = ss.getSheets()[0];
    if (!firstSheet) return [];
    return firstSheet.getDataRange().getValues();
  } finally {
    try {
      if (convertedId) DriveApp.getFileById(convertedId).setTrashed(true);
    } catch (_error) {
      // no-op
    }
    try {
      source.setTrashed(true);
    } catch (_error) {
      // no-op
    }
  }
}

function hddtIsLikelySummaryExcelDataRow(row) {
  if (!Array.isArray(row) || row.length === 0) return false;
  const hasValue = row.some(
    (cell) => cell !== null && cell !== undefined && String(cell).trim() !== "",
  );
  if (!hasValue) return false;
  const headerTokens = [
    "STT",
    "Số hóa đơn",
    "Ngày lập",
    "Ký hiệu",
    "Ký hiệu mẫu số",
    "Kết quả kiểm tra hóa đơn",
  ];
  const looksHeader = row.some((cell) => {
    if (typeof cell !== "string") return false;
    for (let i = 0; i < headerTokens.length; i++) {
      if (cell.indexOf(headerTokens[i]) >= 0) return true;
    }
    return false;
  });
  if (looksHeader) return false;
  const stt = row[0];
  const sttIsNumeric =
    (typeof stt === "number" && Number.isFinite(stt)) ||
    (typeof stt === "string" && /^\d+$/.test(String(stt).trim()));
  return sttIsNumeric && Boolean(row[3]);
}

function hddtNormalizeExcelDateValue(value) {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return Utilities.formatDate(
      value,
      Session.getScriptTimeZone(),
      "dd/MM/yyyy",
    );
  }
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
    return Utilities.formatDate(
      date,
      Session.getScriptTimeZone(),
      "dd/MM/yyyy",
    );
  }
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(text)) return text;
  const parsed = new Date(text);
  if (Number.isFinite(parsed.getTime())) {
    return Utilities.formatDate(
      parsed,
      Session.getScriptTimeZone(),
      "dd/MM/yyyy",
    );
  }
  return text;
}

function hddtMonthLabelFromChunk(chunkTo) {
  const text = String(chunkTo || "").trim();
  const parts = text.split("-");
  if (parts.length !== 3) return text;
  return `${parts[1]}/${parts[0]}`;
}

function hddtBuildSummaryFromExcelCells(cells, meta, rawRow) {
  const khmshdon = hddtNormalizeIdText(cells.khmshdon);
  const khhdon = hddtNormalizeIdText(cells.khhdon);
  const shdon = hddtNormalizeIdText(cells.shdon);
  const nbmst = hddtNormalizeIdText(cells.nbmst);
  const nmmst = hddtNormalizeIdText(cells.nmmst);
  const tdlap = hddtNormalizeExcelDateValue(cells.tdlap);
  const invoiceTaxCode = nbmst || nmmst;
  const invoiceKey = [invoiceTaxCode, khhdon, shdon, khmshdon].join("|");
  const lookupKey = [
    String(meta.category || ""),
    String(meta.ttxly || ""),
    String(invoiceTaxCode || ""),
    String(khmshdon || ""),
    String(khhdon || ""),
    String(shdon || ""),
    String(tdlap || ""),
  ].join("|");
  const totalTaxValue = hddtToNumberOrEmpty(cells.totalTax);
  const statusText = hddtSummaryToTextOrEmpty(cells.invoiceStatus);

  return {
    lookupKey,
    invoiceKey,
    category: meta.category,
    ttxly: String(meta.ttxly),
    tthai: String(meta.tthai || 0),
    invoiceId: "",
    khmshdon,
    khhdon,
    shdon,
    nbmst,
    nbten: hddtSummaryToTextOrEmpty(cells.nbten),
    nbdchi: hddtSummaryToTextOrEmpty(cells.nbdchi),
    nmmst,
    nmten: hddtSummaryToTextOrEmpty(cells.nmten),
    nmdchi: hddtSummaryToTextOrEmpty(cells.nmdchi),
    cccd: hddtNormalizeIdText(cells.cccd),
    tdlap,
    monthLabel: hddtMonthLabelFromChunk(meta.chunkTo),
    tcthue: totalTaxValue,
    totalBeforeTax: hddtToNumberOrEmpty(cells.totalBeforeTax),
    totalTax: totalTaxValue,
    totalDiscount: hddtToNumberOrEmpty(cells.totalDiscount),
    totalFee: hddtToNumberOrEmpty(cells.totalFee),
    tgtttbso: hddtToNumberOrEmpty(cells.totalPayment),
    totalPayment: hddtToNumberOrEmpty(cells.totalPayment),
    tgtttbchu: "",
    currency: hddtSummaryToTextOrEmpty(cells.currency),
    exchangeRate: hddtToNumberOrEmpty(cells.exchangeRate),
    status: statusText,
    invoiceStatus: statusText,
    checkResult: hddtSummaryToTextOrEmpty(cells.checkResult),
    sourcePage: "excel_export",
    sourceChunkFrom: meta.chunkFrom,
    sourceChunkTo: meta.chunkTo,
    raw: JSON.stringify({ excelRow: rawRow }),
    lastSyncedAt: hddtNowIso(),
  };
}

function hddtMapPurchaseExcelRowToSummary(row, meta) {
  const ttxly = Number(meta.ttxly);
  if (ttxly === 8) {
    return hddtBuildSummaryFromExcelCells(
      {
        khmshdon: row[1],
        khhdon: row[2],
        shdon: row[3],
        tdlap: row[4],
        nbmst: row[5],
        nbten: row[6],
        nbdchi: row[7],
        nmmst: row[8],
        nmten: row[9],
        nmdchi: "",
        cccd: row[10],
        totalBeforeTax: row[11],
        totalTax: row[12],
        totalDiscount: row[13],
        totalFee: "",
        totalPayment: row[14],
        currency: "",
        exchangeRate: "",
        invoiceStatus: row[15],
        checkResult: row[16],
      },
      meta,
      row,
    );
  }

  return hddtBuildSummaryFromExcelCells(
    {
      khmshdon: row[1],
      khhdon: row[2],
      shdon: row[3],
      tdlap: row[4],
      nbmst: row[5],
      nbten: row[6],
      nbdchi: row[7],
      nmmst: row[8],
      nmten: row[9],
      nmdchi: "",
      cccd: "",
      totalBeforeTax: row[10],
      totalTax: row[11],
      totalDiscount: row[12],
      totalFee: row[13],
      totalPayment: row[14],
      currency: row[15],
      exchangeRate: row[16],
      invoiceStatus: row[17],
      checkResult: row[18],
    },
    meta,
    row,
  );
}

function hddtMapSoldExcelRowToSummary(row, meta) {
  const ttxly = Number(meta.ttxly);
  if (ttxly === 8) {
    return hddtBuildSummaryFromExcelCells(
      {
        khmshdon: row[1],
        khhdon: row[2],
        shdon: row[3],
        tdlap: row[4],
        nbmst: row[5],
        nbten: row[6],
        nbdchi: "",
        nmmst: row[7],
        nmten: row[8],
        nmdchi: row[9],
        cccd: row[10],
        totalBeforeTax: row[11],
        totalTax: row[12],
        totalDiscount: row[13],
        totalFee: "",
        totalPayment: row[14],
        currency: "",
        exchangeRate: "",
        invoiceStatus: row[15],
        checkResult: row[16],
      },
      meta,
      row,
    );
  }

  return hddtBuildSummaryFromExcelCells(
    {
      khmshdon: row[1],
      khhdon: row[2],
      shdon: row[3],
      tdlap: row[4],
      nbmst: row[5],
      nbten: row[6],
      nbdchi: "",
      nmmst: row[7],
      nmten: row[8],
      nmdchi: row[9],
      cccd: "",
      totalBeforeTax: row[10],
      totalTax: row[11],
      totalDiscount: row[12],
      totalFee: row[13],
      totalPayment: row[14],
      currency: row[15],
      exchangeRate: row[16],
      invoiceStatus: row[17],
      checkResult: row[18],
    },
    meta,
    row,
  );
}

function hddtNormalizeSummaryRow(raw, meta) {
  const now = hddtNowIso();
  const tdlap = hddtNormalizeIdText(
    hddtExtractField(raw, ["tdlap", "ngaylap", "issueDate", "createdDate"]),
  );
  const khmshdon = hddtNormalizeIdText(
    hddtExtractField(raw, ["khmshdon", "mau_so", "invoiceTemplate"]),
  );
  const khhdon = hddtNormalizeIdText(
    hddtExtractField(raw, ["khhdon", "ky_hieu", "invoiceSeries"]),
  );
  const shdon = hddtNormalizeIdText(
    hddtExtractField(raw, ["shdon", "so_hoa_don", "invoiceNo"]),
  );
  const nbmst = hddtNormalizeIdText(
    hddtExtractField(raw, ["nbmst", "sellerTaxCode"]),
  );
  const nmst = hddtNormalizeIdText(
    hddtExtractField(raw, ["nmmst", "buyerTaxCode"]),
  );
  const invoiceTaxCode = nbmst || nmst;
  const invoiceKey = [invoiceTaxCode, khhdon, shdon, khmshdon].join("|");
  const taxFromBreakdown = hddtSummarySumByFields(raw && raw.thttltsuat, [
    "tthue",
    "taxamount",
    "vatamount",
  ]);
  const feeFromBreakdown = hddtSummarySumByFields(raw && raw.thttlphi, [
    "tphi",
    "fee",
    "feeamount",
    "sotien",
    "thtien",
  ]);
  const taxFromMeta = hddtSummaryGetMetaValue(raw, [
    "TotalVATAmount",
    "TotalVATAmountOC",
    "VATAmount",
    "TaxAmount",
  ]);
  const discountFromMeta = hddtSummaryGetMetaValue(raw, [
    "TotalDiscountAmount",
    "TotalDiscountAmountOC",
    "DiscountAmount",
  ]);
  const feeFromMeta = hddtSummaryGetMetaValue(raw, [
    "TotalFeeAmount",
    "TotalFeeAmountOC",
    "FeeAmount",
  ]);
  const totalTaxValue = hddtSummaryPickNumber([
    hddtExtractField(raw, [
      "tcthue",
      "vatAmount",
      "tthue",
      "tgtthue",
      "totalTax",
    ]),
    taxFromMeta,
    taxFromBreakdown,
  ]);
  const totalDiscountValue = hddtSummaryPickNumber([
    hddtExtractField(raw, [
      "tgtkhmai",
      "totalDiscount",
      "discountAmount",
      "ttcktmai",
    ]),
    discountFromMeta,
  ]);
  const totalFeeValue = hddtSummaryPickNumber([
    hddtExtractField(raw, ["tgtphi", "totalFee", "feeAmount"]),
    feeFromMeta,
    feeFromBreakdown,
  ]);
  const normalizedTotalFeeValue =
    typeof totalFeeValue === "number"
      ? totalFeeValue
      : Array.isArray(raw && raw.thttlphi)
        ? 0
        : "";
  const monthLabel = (() => {
    const text = String(meta.chunkTo || "").trim();
    if (!text) return "";
    const parts = text.split("-");
    if (parts.length !== 3) return text;
    return `${parts[1]}/${parts[0]}`;
  })();

  const lookupKey = [
    String(meta.category || ""),
    String(meta.ttxly || ""),
    String(nbmst || nmst || ""),
    String(khmshdon || ""),
    String(khhdon || ""),
    String(shdon || ""),
    String(tdlap || ""),
  ].join("|");

  return {
    lookupKey,
    invoiceKey,
    category: meta.category,
    ttxly: String(meta.ttxly),
    tthai: String(meta.tthai),
    invoiceId: hddtNormalizeIdText(
      hddtExtractField(raw, ["id", "invoiceId", "idhoadon"]),
    ),
    khmshdon,
    khhdon,
    shdon,
    nbmst,
    nbten: hddtSummaryToTextOrEmpty(
      hddtExtractField(raw, ["nbten", "sellerName"]),
    ),
    nbdchi: hddtSummaryToTextOrEmpty(
      hddtExtractField(raw, ["nbdchi", "sellerAddress"]),
    ),
    nmmst: nmst,
    nmten: hddtSummaryToTextOrEmpty(
      hddtExtractField(raw, ["nmten", "buyerName"]),
    ),
    nmdchi: hddtSummaryToTextOrEmpty(
      hddtExtractField(raw, ["nmdchi", "buyerAddress"]),
    ),
    cccd: hddtNormalizeIdText(
      hddtExtractField(raw, ["cccd", "buyerIdNo", "soCccdNguoiMua"]),
    ),
    tdlap,
    monthLabel,
    tcthue: totalTaxValue,
    totalBeforeTax: hddtToNumberOrEmpty(
      hddtExtractField(raw, [
        "tgtcthue",
        "thtien",
        "totalBeforeTax",
        "amountBeforeTax",
      ]),
    ),
    totalTax: totalTaxValue,
    totalDiscount: totalDiscountValue,
    totalFee: normalizedTotalFeeValue,
    tgtttbso: hddtToNumberOrEmpty(
      hddtExtractField(raw, ["tgtttbso", "totalAmount", "amountAfterTax"]),
    ),
    totalPayment: hddtToNumberOrEmpty(
      hddtExtractField(raw, ["tgtttbso", "totalAmount", "amountAfterTax"]),
    ),
    tgtttbchu: hddtSummaryToTextOrEmpty(
      hddtExtractField(raw, ["tgtttbchu", "totalAmountText"]),
    ),
    currency: hddtSummaryToTextOrEmpty(
      hddtExtractField(raw, ["dvtte", "currency"]),
    ),
    exchangeRate: hddtToNumberOrEmpty(
      hddtExtractField(raw, ["tgia", "exchangeRate"]),
    ),
    status: hddtSummaryToTextOrEmpty(
      hddtExtractField(raw, ["tthai", "status"]),
    ),
    invoiceStatus: hddtSummaryToTextOrEmpty(
      hddtExtractField(raw, ["tthai", "status", "invoiceStatus"]),
    ),
    checkResult: hddtSummaryToTextOrEmpty(
      hddtExtractField(raw, ["kqkt", "checkResult", "invoiceCheckResult"]),
    ),
    sourcePage: String(meta.page),
    sourceChunkFrom: meta.chunkFrom,
    sourceChunkTo: meta.chunkTo,
    raw: JSON.stringify(raw),
    lastSyncedAt: now,
  };
}

function hddtSyncSummary(input) {
  hddtAssertLicense("syncSummary");
  const lock = LockService.getScriptLock();
  const hasLock = lock.tryLock(30000);
  if (!hasLock) {
    throw new Error(
      "Hệ thống đang bận (không lấy được lock). Vui lòng thử lại sau vài giây.",
    );
  }

  try {
    hddtEnsureAllSheets();

    const token = hddtRequireToken();
    const category = String((input && input.category) || "sold");
    const requestedTtxly = String(
      (input && input.ttxly) || "all",
    ).toLowerCase();
    // etax-manager has verified purchase 5/6/8 and sold 5/8; do not probe sold=6 silently.
    const ttxlyList =
      requestedTtxly === "all" || requestedTtxly === "*" || !requestedTtxly
        ? category === "purchase"
          ? [5, 6, 8]
          : [5, 8]
        : hddtResolveTtxlyList(requestedTtxly);
    const tthai = Number((input && input.tthai) || 0);
    const dateRange = (input && input.dateRange) || {};
    const chunks = hddtMonthChunks(dateRange.from, dateRange.to);

    const sheetName = HDDT_SHEETS.SUMMARY;

    let totalFetched = 0;
    let totalInserted = 0;
    let totalUpdated = 0;

    for (let c = 0; c < chunks.length; c++) {
      const chunk = chunks[c];
      for (let ti = 0; ti < ttxlyList.length; ti++) {
        const ttxly = ttxlyList[ti];
        const endpoint = hddtBuildSummaryExcelEndpoint(category, ttxly);
        const query = hddtBuildSummaryExcelQuery(category, ttxly, chunk, tthai);
        const blob = hddtFetchSummaryExcelBlob(endpoint, token, query);
        const excelRows = hddtConvertExcelBlobToRows(
          blob,
          `hddt-${category}-${ttxly}-${chunk.from}-${chunk.to}.xlsx`,
        );
        const parsed = hddtEtaxParseWorkbookRows(excelRows || []);
        const normalized = parsed.records.map((row) =>
          hddtEtaxMapSummary(
            row,
            {
              category,
              ttxly,
              fromDate: chunk.from,
              toDate: chunk.to,
            },
            parsed.headers,
          ),
        );
        const upsertResult = hddtUpsertRows(
          sheetName,
          HDDT_HEADERS.summary,
          "summaryKey",
          normalized,
        );
        totalFetched += normalized.length;
        totalInserted += upsertResult.inserted;
        totalUpdated += upsertResult.updated;
      }
    }
    const result = {
      ok: true,
      category,
      ttxly: ttxlyList.length === 1 ? ttxlyList[0] : "all",
      ttxlyList,
      tthai,
      fetched: totalFetched,
      inserted: totalInserted,
      updated: totalUpdated,
      source: "excel_export",
    };

    hddtLog("INFO", "syncSummary", "Đồng bộ bảng kê thành công", result);
    return result;
  } catch (error) {
    hddtLog(
      "ERROR",
      "syncSummary",
      String(error && error.message ? error.message : error),
    );
    throw error;
  } finally {
    if (hasLock) {
      lock.releaseLock();
    }
  }
}
