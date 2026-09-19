function hddtIsTextLikeHeader(header) {
  const textHeaders = {
    summaryKey: true,
    lookupKey: true,
    detailKey: true,
    lineKey: true,
    invoiceKey: true,
    category: true,
    ttxly: true,
    tthai: true,
    invoiceId: true,
    khmshdon: true,
    khhdon: true,
    shdon: true,
    nbmst: true,
    nmmst: true,
    cccd: true,
    monthLabel: true,
    currency: true,
    status: true,
    invoiceStatus: true,
    checkResult: true,
    sellerTaxCode: true,
    buyerTaxCode: true,
    counterpartyTaxCode: true,
    formSymbol: true,
    invoiceSymbol: true,
    invoiceNumber: true,
    invoiceReference: true,
    detailFetchedAt: true,
    updatedAt: true,
    sourcePage: true,
    sourceChunkFrom: true,
    sourceChunkTo: true,
    lastSyncedAt: true,
    nbdchi: true,
    nmdchi: true,
    ten: true,
    dvtinh: true,
    itemName: true,
    unit: true,
    loaiHangHoaDacTrung: true,
    ltsuat: true,
  };
  return Boolean(textHeaders[String(header || "").trim()]);
}

function hddtGetHeaderLabels(headers) {
  return (headers || []).map((header) =>
    HDDT_HEADER_LABELS && HDDT_HEADER_LABELS[header]
      ? HDDT_HEADER_LABELS[header]
      : header
  );
}

function hddtApplyTextFormats(sheet, headers) {
  const rowCount = Math.max(sheet.getMaxRows() - 1, 1);
  headers.forEach((header, i) => {
    if (!hddtIsTextLikeHeader(header)) return;
    sheet.getRange(2, i + 1, rowCount, 1).setNumberFormat("@");
  });
}

function hddtNormalizeHeaderRow(values) {
  return (values || []).map((v) => String(v || "").trim());
}

function hddtBuildHeaderIndex(headers) {
  const indexByHeader = {};
  (headers || []).forEach((header, idx) => {
    const name = String(header || "").trim();
    if (!name) return;
    if (indexByHeader[name] !== undefined) return;
    indexByHeader[name] = idx;
  });
  return indexByHeader;
}

function hddtBuildMigrationSamples(oldHeaders, oldDataRows, newHeaders, newDataRows) {
  const sampleCount = Math.min(2, oldDataRows.length, newDataRows.length);
  if (sampleCount <= 0) return [];

  const preferred = [
    "lookupKey",
    "detailKey",
    "invoiceKey",
    "khmshdon",
    "khhdon",
    "shdon",
    "nbmst",
    "nmmst",
    "tdlap",
    "tgtttbso",
    "tcthue",
    "itemName",
    "quantity",
    "amountBeforeTax",
  ];
  const oldIdx = hddtBuildHeaderIndex(oldHeaders);
  const newIdx = hddtBuildHeaderIndex(newHeaders);

  const fields = preferred.filter((field) => oldIdx[field] !== undefined || newIdx[field] !== undefined).slice(0, 6);
  if (!fields.length) return [];

  const samples = [];
  for (let i = 0; i < sampleCount; i++) {
    const before = {};
    const after = {};
    fields.forEach((field) => {
      const oi = oldIdx[field];
      const ni = newIdx[field];
      before[field] = oi === undefined ? "" : oldDataRows[i][oi];
      after[field] = ni === undefined ? "" : newDataRows[i][ni];
    });
    samples.push({ row: i + 2, before, after });
  }
  return samples;
}

function hddtMigrateSheetHeaderIfNeeded(sheet, sheetName, headers) {
  const targetHeaders = hddtNormalizeHeaderRow(hddtGetHeaderLabels(headers));
  const lastColumn = Math.max(sheet.getLastColumn(), targetHeaders.length);
  const currentHeaders = hddtNormalizeHeaderRow(sheet.getRange(1, 1, 1, lastColumn).getValues()[0]);
  const sameHeader =
    currentHeaders.length === targetHeaders.length &&
    targetHeaders.every((header, index) => currentHeaders[index] === header);

  if (sameHeader) {
    return { migrated: false, fromHeaders: currentHeaders, toHeaders: targetHeaders, rowCount: 0 };
  }

  const lastRow = sheet.getLastRow();
  const rowCount = Math.max(lastRow - 1, 0);
  const oldDataRows = rowCount > 0 ? sheet.getRange(2, 1, rowCount, lastColumn).getValues() : [];
  const oldIndexByHeader = hddtBuildHeaderIndex(currentHeaders);
  const newDataRows = oldDataRows.map((row) =>
    targetHeaders.map((header) => {
      const oldIndex = oldIndexByHeader[header];
      return oldIndex === undefined ? "" : row[oldIndex];
    })
  );

  sheet.getRange(1, 1, 1, targetHeaders.length).setValues([targetHeaders]);
  if (rowCount > 0) {
    const clearWidth = Math.max(lastColumn, targetHeaders.length);
    sheet.getRange(2, 1, rowCount, clearWidth).clearContent();
    sheet.getRange(2, 1, rowCount, targetHeaders.length).setValues(newDataRows);
  }

  const migrationInfo = {
    migrated: true,
    sheetName,
    rowCount,
    oldHeaderCount: currentHeaders.filter(Boolean).length,
    newHeaderCount: targetHeaders.length,
    samples: hddtBuildMigrationSamples(currentHeaders, oldDataRows, targetHeaders, newDataRows),
  };

  try {
    if (typeof hddtLog === "function") {
      hddtLog("INFO", "sheetHeaderMigration", "Migrated sheet headers using name-based remap", migrationInfo);
    }
  } catch (_error) {
    // ignore logging failures to avoid blocking sync/list operations
  }

  return migrationInfo;
}

function hddtGetOrCreateSheet(sheetName, headers) {
  const ss = getDatabaseSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  hddtMigrateSheetHeaderIfNeeded(sheet, sheetName, headers);
  hddtApplyTextFormats(sheet, headers);

  return sheet;
}

function hddtConfigureReaderSheet(sheet, config) {
  const headers = config.headers || [];
  const hiddenHeaders = config.hiddenHeaders || [];
  const lastRow = Math.max(sheet.getLastRow(), 1);
  const headerRange = sheet.getRange(1, 1, 1, headers.length);

  sheet.setFrozenRows(1);
  sheet.setTabColor(config.tabColor || null);
  headerRange
    .setBackground("#1F4E78")
    .setFontColor("#FFFFFF")
    .setFontWeight("bold")
    .setVerticalAlignment("middle");
  sheet.setRowHeight(1, 28);

  const filter = sheet.getFilter();
  if (!filter && lastRow > 1) {
    sheet.getRange(1, 1, lastRow, headers.length).createFilter();
  }

  sheet.showColumns(1, headers.length);
  hiddenHeaders.forEach((header) => {
    const index = headers.indexOf(header);
    if (index >= 0) sheet.hideColumns(index + 1);
  });

  ["invoiceDate"].forEach((header) => {
    const index = headers.indexOf(header);
    if (index >= 0) sheet.getRange(2, index + 1, Math.max(sheet.getMaxRows() - 1, 1), 1).setNumberFormat("dd/mm/yyyy");
  });
  ["totalBeforeTax", "totalTax", "totalDiscount", "totalPayment", "dgia", "stckhau", "thtien", "tthue", "signedAmount", "signedTaxAmount"].forEach((header) => {
    const index = headers.indexOf(header);
    if (index >= 0) sheet.getRange(2, index + 1, Math.max(sheet.getMaxRows() - 1, 1), 1).setNumberFormat("#,##0");
  });
  ["tsuat"].forEach((header) => {
    const index = headers.indexOf(header);
    if (index >= 0) sheet.getRange(2, index + 1, Math.max(sheet.getMaxRows() - 1, 1), 1).setNumberFormat("0%");
  });
}

function hddtEnsureSheetRowCapacity(sheet, requiredLastRow) {
  const missing = Number(requiredLastRow || 0) - sheet.getMaxRows();
  if (missing > 0) sheet.insertRowsAfter(sheet.getMaxRows(), Math.max(missing, 100));
}

function hddtTrimUnusedRows(sheet, minimumRows) {
  const keepRows = Math.max(Number(minimumRows || 100), sheet.getLastRow() + 50);
  const extraRows = sheet.getMaxRows() - keepRows;
  if (extraRows > 0) sheet.deleteRows(keepRows + 1, extraRows);
}

function hddtReadExistingRowsByKey(sheetName, headers, keyColumn) {
  const rows = hddtReadSheetObjects(sheetName, headers);
  return rows.reduce((result, row) => {
    const key = String(row[keyColumn] || "").trim();
    if (key) result[key] = row;
    return result;
  }, {});
}

function hddtPreserveSummaryDetailState(category, rows) {
  const existingByKey = hddtReadExistingRowsByKey(
    hddtGetSummarySheetByCategory(category),
    HDDT_HEADERS.summary,
    "summaryKey"
  );
  return (rows || []).map((row) => {
    const existing = existingByKey[String(row.summaryKey || "").trim()];
    if (!existing) return row;
    return Object.assign({}, row, {
      detailFetchedAt: existing.detailFetchedAt || "",
      detailLineCount: existing.detailLineCount || "",
    });
  });
}

function hddtMarkSummaryDetailFetched(category, summaryKey, lineCount) {
  const sheetName = hddtGetSummarySheetByCategory(category);
  const existing = hddtReadExistingRowsByKey(sheetName, HDDT_HEADERS.summary, "summaryKey")[String(summaryKey || "").trim()];
  if (!existing) throw new Error(`Không tìm thấy hóa đơn để cập nhật chi tiết: ${summaryKey}`);
  const row = Object.assign({}, existing, {
    detailFetchedAt: hddtNowIso(),
    detailLineCount: lineCount,
    updatedAt: hddtNowIso(),
  });
  return hddtUpsertRows(sheetName, HDDT_HEADERS.summary, "summaryKey", [row]);
}

function hddtReadLegacySheetObjects(sheetName, headers) {
  const sheet = getDatabaseSpreadsheet().getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() <= 1) return [];
  const values = hddtReadSheetMatrix(sheetName, 2, 1, sheet.getLastRow() - 1, headers.length, {
    displayValues: false,
    pad: true,
  });
  return values.map((row) => headers.reduce((result, header, index) => {
    result[header] = row[index];
    return result;
  }, {})).filter((row) => Object.keys(row).some((key) => row[key] !== "" && row[key] !== null));
}

function hddtBuildInvoiceReference(row) {
  return [row.formSymbol, row.invoiceSymbol, row.invoiceNumber]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" - ");
}

function hddtBuildReaderSummaryFromLegacy(row) {
  const category = String(row.category || "").trim();
  if (category !== "purchase" && category !== "sold") {
    throw new Error(`Không thể chuyển hóa đơn thiếu loại mua/bán: ${row.summaryKey || "không rõ mã"}`);
  }
  const isPurchase = category === "purchase";
  return {
    category,
    invoiceDate: row.invoiceDate,
    formSymbol: row.formSymbol,
    invoiceSymbol: row.invoiceSymbol,
    invoiceNumber: row.invoiceNumber,
    counterpartyTaxCode: isPurchase ? row.sellerTaxCode : row.buyerTaxCode,
    counterpartyName: isPurchase ? row.sellerName : row.buyerName,
    totalBeforeTax: row.totalBeforeTax,
    totalTax: row.totalTax,
    totalDiscount: row.totalDiscount,
    totalPayment: row.totalPayment,
    currency: row.currency,
    invoiceStatus: row.invoiceStatus,
    checkResult: row.checkResult,
    counterpartyIsHighRisk: row.counterpartyIsHighRisk,
    summaryKey: row.summaryKey,
    invoiceKey: row.invoiceKey,
    ttxly: row.ttxly,
    detailFetchedAt: "",
    detailLineCount: "",
    sellerTaxCode: row.sellerTaxCode,
    updatedAt: row.updatedAt || hddtNowIso(),
  };
}

function hddtMigrateLegacySheetsIfNeeded() {
  const ss = getDatabaseSpreadsheet();
  const legacySummary = ss.getSheetByName(HDDT_LEGACY_SHEETS.SUMMARY);
  if (!legacySummary || legacySummary.getLastRow() <= 1) return false;

  const readerHasData = [HDDT_SHEETS.PURCHASE_SUMMARY, HDDT_SHEETS.SOLD_SUMMARY]
    .some((sheetName) => {
      const sheet = ss.getSheetByName(sheetName);
      return sheet && sheet.getLastRow() > 1;
    });
  if (readerHasData) return false;

  const oldSummaries = hddtReadLegacySheetObjects(HDDT_LEGACY_SHEETS.SUMMARY, HDDT_LEGACY_HEADERS.summary)
    .map(hddtBuildReaderSummaryFromLegacy);
  const oldDetails = hddtReadLegacySheetObjects(HDDT_LEGACY_SHEETS.DETAIL, HDDT_LEGACY_HEADERS.detail);
  const detailBySummaryKey = oldDetails.reduce((result, row) => {
    result[String(row.summaryKey || "").trim()] = row;
    return result;
  }, {});
  oldSummaries.forEach((row) => {
    const detail = detailBySummaryKey[String(row.summaryKey || "").trim()];
    if (!detail) return;
    row.detailFetchedAt = detail.fetchedAt || detail.updatedAt || hddtNowIso();
    row.detailLineCount = detail.lineCount || 0;
  });

  const summaryByKey = oldSummaries.reduce((result, row) => {
    result[String(row.summaryKey || "").trim()] = row;
    return result;
  }, {});
  const groupedSummaries = { purchase: [], sold: [] };
  oldSummaries.forEach((row) => groupedSummaries[row.category].push(row));
  Object.keys(groupedSummaries).forEach((category) => {
    const rows = groupedSummaries[category];
    if (!rows.length) return;
    hddtUpsertRows(hddtGetSummarySheetByCategory(category), HDDT_HEADERS.summary, "summaryKey", rows);
  });

  const oldLines = hddtReadLegacySheetObjects(HDDT_LEGACY_SHEETS.DETAIL_LINE, HDDT_LEGACY_HEADERS.detailLine);
  const groupedLines = { purchase: [], sold: [] };
  oldLines.forEach((line) => {
    const parent = summaryByKey[String(line.summaryKey || "").trim()];
    if (!parent) throw new Error(`Không thể chuyển dòng hàng thiếu hóa đơn: ${line.lineKey || "không rõ mã"}`);
    groupedLines[parent.category].push({
      invoiceDate: parent.invoiceDate,
      invoiceReference: hddtBuildInvoiceReference(parent),
      counterpartyTaxCode: parent.counterpartyTaxCode,
      counterpartyName: parent.counterpartyName,
      stt: line.stt,
      ten: line.ten,
      dvtinh: line.dvtinh,
      sluong: line.sluong,
      dgia: line.dgia,
      stckhau: line.stckhau,
      tsuat: line.tsuat,
      thtien: line.thtien,
      tthue: line.tthue,
      lineKey: line.lineKey,
      summaryKey: line.summaryKey,
      lineNature: line.lineNature,
      signedAmount: line.signedAmount,
      signedTaxAmount: line.signedTaxAmount,
      updatedAt: line.updatedAt || hddtNowIso(),
    });
  });
  Object.keys(groupedLines).forEach((category) => {
    const rows = groupedLines[category];
    if (!rows.length) return;
    hddtUpsertRows(hddtGetDetailSheetByCategory(category), HDDT_HEADERS.detailLine, "lineKey", rows);
  });

  const migratedSummaryCount = Object.keys(groupedSummaries).reduce((total, category) => total + groupedSummaries[category].length, 0);
  const migratedLineCount = Object.keys(groupedLines).reduce((total, category) => total + groupedLines[category].length, 0);
  if (migratedSummaryCount !== oldSummaries.length || migratedLineCount !== oldLines.length) {
    throw new Error("Kiểm tra chuyển đổi dữ liệu thất bại; chưa xóa các sheet cấu trúc cũ.");
  }

  [HDDT_LEGACY_SHEETS.SUMMARY, HDDT_LEGACY_SHEETS.DETAIL, HDDT_LEGACY_SHEETS.DETAIL_LINE].forEach((sheetName) => {
    const sheet = ss.getSheetByName(sheetName);
    if (sheet) ss.deleteSheet(sheet);
  });
  Object.keys(HDDT_READER_SHEET_CONFIG).forEach((sheetName) => {
    const config = HDDT_READER_SHEET_CONFIG[sheetName];
    hddtConfigureReaderSheet(ss.getSheetByName(sheetName), config);
  });
  hddtLog("INFO", "readerSheetMigration", "Đã chuyển dữ liệu sang bốn sheet hiển thị", {
    summaries: migratedSummaryCount,
    lines: migratedLineCount,
  });
  return true;
}

function hddtReadSheetMatrix(sheetName, startRow, startCol, rowCount, colCount, options) {
  const safeRowCount = Math.max(0, Number(rowCount || 0));
  const safeColCount = Math.max(0, Number(colCount || 0));
  if (!safeRowCount || !safeColCount) return [];

  const fromV4 = hddtSheetsV4GetValues(sheetName, startRow, startCol, safeRowCount, safeColCount, options);
  if (fromV4 !== null) return fromV4;

  const sheet = getDatabaseSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return [];
  const values = sheet.getRange(startRow, startCol, safeRowCount, safeColCount).getValues();
  return hddtPadMatrix(values, safeRowCount, safeColCount);
}

function hddtReadSheetObjects(sheetName, headers) {
  const sheet = hddtGetOrCreateSheet(sheetName, headers);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  const data = hddtReadSheetMatrix(sheetName, 2, 1, lastRow - 1, headers.length, {
    displayValues: false,
    pad: true,
  });
  return data.map((row) => {
    const out = {};
    headers.forEach((header, index) => {
      out[header] = row[index];
    });
    return out;
  });
}

function hddtGetSheetTouchKey(sheetName) {
  return `HDDT_SHEET_TOUCH_${String(sheetName || "").trim()}`;
}

function hddtMarkSheetTouched(sheetName) {
  const key = hddtGetSheetTouchKey(sheetName);
  PropertiesService.getScriptProperties().setProperty(key, String(Date.now()));
}

function hddtGetSheetTouchVersion(sheetName) {
  const key = hddtGetSheetTouchKey(sheetName);
  return PropertiesService.getScriptProperties().getProperty(key) || "0";
}

function hddtNormalizeWriteRowValues(headers, row) {
  return headers.map((header) => {
    const value = row[header];
    if (value === undefined || value === null) return "";
    if (hddtIsTextLikeHeader(header)) return String(value);
    return value;
  });
}

function hddtWriteContiguousBlocks(sheetName, headers, updates, sheetFallback) {
  if (!Array.isArray(updates) || updates.length === 0) return;

  const sorted = updates.slice().sort((a, b) => a.rowIndex - b.rowIndex);
  const blocks = [];
  let blockStart = sorted[0].rowIndex;
  let blockValues = [sorted[0].values];
  let prevRow = sorted[0].rowIndex;

  for (let i = 1; i < sorted.length; i++) {
    const item = sorted[i];
    if (item.rowIndex === prevRow + 1) {
      blockValues.push(item.values);
    } else {
      blocks.push({ startRow: blockStart, values: blockValues });
      blockStart = item.rowIndex;
      blockValues = [item.values];
    }
    prevRow = item.rowIndex;
  }
  if (blockValues.length > 0) {
    blocks.push({ startRow: blockStart, values: blockValues });
  }

  const wroteByV4 = hddtSheetsV4BatchWriteValues(
    blocks.map((block) => ({
      sheetName,
      startRow: block.startRow,
      startCol: 1,
      values: block.values,
    })),
    { valueInputOption: "USER_ENTERED" }
  );
  if (wroteByV4) return;

  const sheet = sheetFallback || hddtGetOrCreateSheet(sheetName, headers);
  blocks.forEach((block) => {
    sheet.getRange(block.startRow, 1, block.values.length, headers.length).setValues(block.values);
  });
}

function hddtUpsertRows(sheetName, headers, keyColumn, rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { inserted: 0, updated: 0, total: 0 };
  }

  const sheet = hddtGetOrCreateSheet(sheetName, headers);
  const keyIndex = headers.indexOf(keyColumn);
  if (keyIndex < 0) {
    throw new Error(`Missing key column ${keyColumn} in sheet ${sheetName}`);
  }

  const lastRow = sheet.getLastRow();
  const indexByKey = {};

  if (lastRow > 1) {
    const keys = hddtReadSheetMatrix(sheetName, 2, keyIndex + 1, lastRow - 1, 1, {
      displayValues: false,
      pad: true,
    });
    keys.forEach((arr, i) => {
      const key = String(arr[0] || "").trim();
      if (!key) return;
      indexByKey[key] = i + 2;
    });
  }

  const updates = [];
  const inserts = [];

  rows.forEach((row) => {
    const key = String(row[keyColumn] || "").trim();
    if (!key) return;

    const values = hddtNormalizeWriteRowValues(headers, row);

    if (indexByKey[key]) {
      updates.push({ rowIndex: indexByKey[key], values });
    } else {
      inserts.push(values);
    }
  });

  if (updates.length > 0) {
    hddtWriteContiguousBlocks(sheetName, headers, updates, sheet);
  }

  if (inserts.length > 0) {
    const startRow = sheet.getLastRow() + 1;
    hddtEnsureSheetRowCapacity(sheet, startRow + inserts.length - 1);
    const wroteByV4 = hddtSheetsV4BatchWriteValues(
      [
        {
          sheetName,
          startRow,
          startCol: 1,
          values: inserts,
        },
      ],
      { valueInputOption: "USER_ENTERED" }
    );
    if (!wroteByV4) {
      sheet.getRange(startRow, 1, inserts.length, headers.length).setValues(inserts);
    }
  }

  if (inserts.length > 0 || updates.length > 0) {
    hddtMarkSheetTouched(sheetName);
    if (HDDT_READER_SHEET_CONFIG && HDDT_READER_SHEET_CONFIG[sheetName]) {
      hddtTrimUnusedRows(sheet, 100);
    }
  }

  return {
    inserted: inserts.length,
    updated: updates.length,
    total: inserts.length + updates.length,
  };
}
