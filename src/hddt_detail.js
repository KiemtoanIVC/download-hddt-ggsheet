function hddtBuildDetailEndpoint(category, ttxly) {
  const useSco = Number(ttxly) === 8;
  if (category === "sold") {
    return useSco ? "/sco-query/invoices/detail" : "/query/invoices/detail";
  }
  return useSco ? "/sco-query/invoices/detail" : "/query/invoices/detail";
}

function hddtResolveDetailTtxlyList(rawTtxly) {
  const text = String(rawTtxly || "").trim().toLowerCase();
  if (!text || text === "all" || text === "*") return [5, 6, 8];
  const n = Number(text);
  if (n === 5 || n === 6 || n === 8) return [n];
  return [5];
}

function hddtReadExistingDetailSummaryKeySet(category) {
  const set = new Set();
  hddtReadSheetObjects(hddtGetSummarySheetByCategory(category), HDDT_HEADERS.summary).forEach((row) => {
    const key = String(row.summaryKey || "").trim();
    if (key && String(row.detailFetchedAt || "").trim()) set.add(key);
  });
  return set;
}

function hddtToIdText(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" && Number.isFinite(value)) {
    return Utilities.formatString("%.0f", value);
  }
  return String(value).trim();
}

function hddtDetailToTextOrEmpty(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
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
  if (!cleaned || cleaned === "-" || cleaned === "." || cleaned === "-.") return "";
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : "";
}

function hddtParseTaxRate(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.endsWith("%")) {
      const numeric = hddtToNumberOrEmpty(trimmed.replace("%", ""));
      return typeof numeric === "number" ? numeric / 100 : "";
    }
  }
  return hddtToNumberOrEmpty(value);
}

function hddtGetTtkhacValue(line, field) {
  const list = Array.isArray(line && line.ttkhac) ? line.ttkhac : [];
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (item && item.ttruong === field) {
      return item.dlieu === null || item.dlieu === undefined ? "" : String(item.dlieu);
    }
  }
  return "";
}

function hddtExtractDetailLines(payload) {
  if (!payload) return [];
  const toArray = (value) => {
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object") return [value];
    return [];
  };
  const looksLikeLine = (obj) => {
    if (!obj || typeof obj !== "object") return false;
    const keys = Object.keys(obj);
    if (!keys.length) return false;
    return (
      keys.indexOf("ten") >= 0 ||
      keys.indexOf("itemName") >= 0 ||
      keys.indexOf("dgia") >= 0 ||
      keys.indexOf("unitPrice") >= 0 ||
      keys.indexOf("sluong") >= 0 ||
      keys.indexOf("quantity") >= 0 ||
      keys.indexOf("thtien") >= 0 ||
      keys.indexOf("amountBeforeTax") >= 0
    );
  };

  const roots = [payload, payload.data, payload.result, payload.content].filter(Boolean);
  for (let i = 0; i < roots.length; i++) {
    const root = roots[i];
    if (Array.isArray(root)) return root;
    if (typeof root !== "object") continue;

    if (Array.isArray(root.hdhhdvu)) return root.hdhhdvu;
    if (root.hdhhdvu && typeof root.hdhhdvu === "object") return toArray(root.hdhhdvu);
    if (root.hdon && Array.isArray(root.hdon.hdhhdvu)) return root.hdon.hdhhdvu;
    if (root.hdon && root.hdon.hdhhdvu && typeof root.hdon.hdhhdvu === "object") return toArray(root.hdon.hdhhdvu);
    if (Array.isArray(root.tthhdv)) return root.tthhdv;
    if (root.tthhdv && typeof root.tthhdv === "object") return toArray(root.tthhdv);
    if (root.hdon && Array.isArray(root.hdon.tthhdv)) return root.hdon.tthhdv;
    if (root.hdon && root.hdon.tthhdv && typeof root.hdon.tthhdv === "object") return toArray(root.hdon.tthhdv);

    const candidates = [
      root.lines,
      root.items,
      root.details,
      root.ctiet,
      root.datas,
      root.data,
      root.dsHHDVu,
      root.hhdvu,
      root.goods,
      root.products,
    ];

    for (let j = 0; j < candidates.length; j++) {
      if (Array.isArray(candidates[j])) return candidates[j];
      if (candidates[j] && typeof candidates[j] === "object") {
        const single = toArray(candidates[j]);
        if (single.length && looksLikeLine(single[0])) return single;
      }
    }

    if (looksLikeLine(root)) {
      return [root];
    }
  }

  return [];
}

function hddtNormalizeDetailRow(line, invoice, category) {
  const lineNo = Number(hddtExtractField(line, ["lineNo", "stt", "soThuTu", "index"]) || 0);
  const lookupKey = String(invoice.lookupKey || "");
  const invoiceKey = String(invoice.invoiceKey || "");
  const itemName = hddtDetailToTextOrEmpty(hddtExtractField(line, ["itemName", "ten", "tenHHDVu", "name"]));
  const unit = hddtDetailToTextOrEmpty(hddtExtractField(line, ["unit", "dvtinh", "donViTinh"]));
  const quantity = hddtToNumberOrEmpty(hddtExtractField(line, ["quantity", "sluong", "soLuong"]));
  const unitPrice = hddtToNumberOrEmpty(hddtExtractField(line, ["unitPrice", "dgia", "donGia"]));
  const discount = hddtToNumberOrEmpty(hddtExtractField(line, ["stckhau", "discountAmount"]));
  const amountBeforeTaxRaw = hddtToNumberOrEmpty(
    hddtExtractField(line, ["amountBeforeTax", "thtien", "thanhTien"])
  );
  const amountBeforeTax =
    typeof amountBeforeTaxRaw === "number"
      ? amountBeforeTaxRaw
      : typeof quantity === "number" && typeof unitPrice === "number"
        ? unitPrice * quantity - (typeof discount === "number" ? discount : 0)
        : "";
  const vatRate = hddtParseTaxRate(hddtExtractField(line, ["vatRate", "tsuat", "thueSuat", "ltsuat"]));
  const vatAmountRaw = hddtToNumberOrEmpty(hddtExtractField(line, ["vatAmount", "tthue", "tienThue"]));
  const vatAmount =
    typeof vatAmountRaw === "number"
      ? vatAmountRaw
      : typeof amountBeforeTax === "number" && typeof vatRate === "number"
        ? amountBeforeTax * vatRate
        : "";
  const amountAfterTaxRaw = hddtToNumberOrEmpty(
    hddtExtractField(line, ["amountAfterTax", "tgtttbso", "tongTien", "tongCong", "thtt"])
  );
  const amountAfterTax =
    typeof amountAfterTaxRaw === "number"
      ? amountAfterTaxRaw
      : typeof amountBeforeTax === "number" && typeof vatAmount === "number"
        ? amountBeforeTax + vatAmount
        : "";
  const loaiHangHoaDacTrung =
    hddtGetTtkhacValue(line, "InventoryItemCategoryName") ||
    hddtGetTtkhacValue(line, "InventoryItemCategoryCode");
  const fallbackIdentity = [
    hddtToIdText(itemName),
    hddtToIdText(unit),
    hddtToIdText(quantity),
    hddtToIdText(unitPrice),
    hddtToIdText(amountBeforeTax),
    hddtToIdText(vatRate),
    hddtToIdText(vatAmount),
  ].join("|");
  const stableLineId = lineNo > 0 ? String(lineNo) : fallbackIdentity;

  return {
    detailKey: `${lookupKey}::${stableLineId}`,
    lookupKey,
    invoiceKey,
    category,
    invoiceId: invoice.invoiceId || "",
    lineNo,
    itemName,
    ten: itemName,
    unit,
    dvtinh: unit,
    quantity,
    sluong: quantity,
    unitPrice,
    dgia: unitPrice,
    stckhau: discount,
    amountBeforeTax,
    thtien: amountBeforeTax,
    vatRate,
    tsuat: vatRate,
    ltsuat: hddtDetailToTextOrEmpty(hddtExtractField(line, ["ltsuat"])),
    vatAmount,
    tthue: vatAmount,
    amountAfterTax,
    tchat: hddtToNumberOrEmpty(hddtExtractField(line, ["tchat"])),
    loaiHangHoaDacTrung,
    raw: JSON.stringify(line),
    lastSyncedAt: hddtNowIso(),
  };
}

function hddtDetailDateMatches(value, dateRange) {
  const range = dateRange || {};
  if (!range.from && !range.to) return true;
  const text = String(value || "").trim();
  const dmy = text.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  const parsed = dmy
    ? new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]))
    : new Date(text);
  if (!Number.isFinite(parsed.getTime())) return false;
  const time = parsed.getTime();
  if (range.from && time < hddtParseDateYmd(range.from).getTime()) return false;
  if (range.to) {
    const end = hddtParseDateYmd(range.to);
    end.setHours(23, 59, 59, 999);
    if (time > end.getTime()) return false;
  }
  return true;
}

function hddtSyncDetail(input) {
  hddtAssertLicense("syncDetail");
  const lock = LockService.getScriptLock();
  const hasLock = lock.tryLock(30000);
  if (!hasLock) {
    throw new Error("Hệ thống đang bận (không lấy được lock). Vui lòng thử lại sau vài giây.");
  }

  try {
    hddtEnsureAllSheets();

    const token = hddtRequireToken();
    const category = String((input && input.category) || "sold");
    const ttxlyList = hddtResolveDetailTtxlyList(input && input.ttxly);
    const maxInvoices = Number((input && input.maxInvoices) || 100);
    const forceRefresh = Boolean(input && input.forceRefresh);

    const summarySheetName = hddtGetSummarySheetByCategory(category);
    const ttxlySet = new Set(ttxlyList.map((x) => String(x)));
    const dateRange = (input && input.dateRange) || {};
    const summaryRows = hddtReadSheetObjects(summarySheetName, HDDT_HEADERS.summary)
      .filter((row) => ttxlySet.has(String(row.ttxly)))
      .filter((row) => hddtDetailDateMatches(row.invoiceDate, dateRange));

    const existingDetailKeySet = forceRefresh ? new Set() : hddtReadExistingDetailSummaryKeySet(category);
    const pendingRows = summaryRows.filter((row) => {
      const summaryKey = String(row.summaryKey || "").trim();
      if (!summaryKey) return false;
      return forceRefresh || !existingDetailKeySet.has(summaryKey);
    });
    const invoices = pendingRows.slice(0, maxInvoices);

    let fetchedInvoices = 0;
    let lineCount = 0;
    let inserted = 0;
    let updated = 0;
    let noLineInvoices = 0;
    let failedInvoices = 0;

    invoices.forEach((invoice) => {
      const rowTtxly = Number(invoice.ttxly || 0);
      const endpoint = hddtBuildDetailEndpoint(category, rowTtxly);
      const query = {
        khmshdon: hddtToIdText(invoice.formSymbol),
        khhdon: hddtToIdText(invoice.invoiceSymbol),
        shdon: hddtToIdText(invoice.invoiceNumber),
        nbmst: hddtToIdText(invoice.sellerTaxCode),
      };

      try {
        const url = `${hddtGetApiBaseUrl()}${endpoint}${hddtBuildQueryString(query)}`;
        const detailResponse = hddtRequestJson({ method: "get", url, token, retry: { retries: 2, backoffMs: 500 } });
        const payload = detailResponse.json || {};
        const summaryKey = String(invoice.summaryKey || "");
        const lines = hddtExtractDetailLines(payload);
        fetchedInvoices += 1;
        if (!lines.length) noLineInvoices += 1;
        const normalizedLines = lines.map((line) => hddtEtaxMapDetailLine(line, invoice));
        const lineResult = hddtUpsertRows(hddtGetDetailSheetByCategory(category), HDDT_HEADERS.detailLine, "lineKey", normalizedLines);
        hddtMarkSummaryDetailFetched(category, summaryKey, lines.length);
        lineCount += normalizedLines.length;
        inserted += lineResult.inserted;
        updated += lineResult.updated;
      } catch (error) {
        failedInvoices += 1;
        const message = String(error && error.message ? error.message : error || "");
        hddtLog("WARN", "syncDetail", "Bỏ qua hóa đơn không tải được chi tiết", {
          category,
          ttxly: rowTtxly,
          summaryKey: invoice.summaryKey,
          invoiceKey: invoice.invoiceKey,
          error: message,
        });
      }
    });

    const skippedExisting = summaryRows.length - pendingRows.length;
    const deferredByLimit = Math.max(0, pendingRows.length - invoices.length);

    const result = {
      ok: true,
      category,
      ttxly: ttxlyList.length === 1 ? ttxlyList[0] : "all",
      ttxlyList,
      scannedSummary: summaryRows.length,
      pendingInvoices: pendingRows.length,
      skippedExisting,
      deferredByLimit,
      forceRefresh,
      fetchedInvoices,
      failedInvoices,
      noLineInvoices,
      lines: lineCount,
      inserted,
      updated,
    };

    hddtLog("INFO", "syncDetail", "Đồng bộ chi tiết thành công", result);
    return result;
  } catch (error) {
    hddtLog("ERROR", "syncDetail", String(error && error.message ? error.message : error));
    throw error;
  } finally {
    if (hasLock) {
      lock.releaseLock();
    }
  }
}
