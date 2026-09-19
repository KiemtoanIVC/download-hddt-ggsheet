function hddtReadScriptBoolProperty(name, defaultValue) {
  const raw = PropertiesService.getScriptProperties().getProperty(name);
  if (raw === null || raw === undefined || String(raw).trim() === "") return Boolean(defaultValue);
  const normalized = String(raw).trim().toLowerCase();
  if (["1", "true", "yes", "on"].indexOf(normalized) >= 0) return true;
  if (["0", "false", "no", "off"].indexOf(normalized) >= 0) return false;
  return Boolean(defaultValue);
}

function hddtIsSheetsV4ServiceReady() {
  return Boolean(
    typeof Sheets !== "undefined" &&
      Sheets &&
      Sheets.Spreadsheets &&
      Sheets.Spreadsheets.Values &&
      typeof Sheets.Spreadsheets.Values.get === "function"
  );
}

function hddtUseSheetsV4Read() {
  return hddtReadScriptBoolProperty("HDDT_USE_SHEETS_V4_READ", true);
}

function hddtUseSheetsV4Write() {
  return hddtReadScriptBoolProperty("HDDT_USE_SHEETS_V4_WRITE", true);
}

function hddtUseSheetsV4FallbackLegacy() {
  return hddtReadScriptBoolProperty("HDDT_V4_FALLBACK_LEGACY", true);
}

function hddtShouldRunSheetsV4(mode) {
  if (!hddtIsSheetsV4ServiceReady()) return false;
  if (mode === "write") return hddtUseSheetsV4Write();
  return hddtUseSheetsV4Read();
}

function hddtColumnToA1Label(column) {
  let n = Math.max(1, Number(column || 1));
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function hddtEscapeSheetNameForA1(sheetName) {
  const raw = String(sheetName || "").trim();
  if (!raw) throw new Error("sheetName is required");
  return `'${raw.replace(/'/g, "''")}'`;
}

function hddtBuildA1RangeFromGrid(sheetName, startRow, startCol, rowCount, colCount) {
  const safeStartRow = Math.max(1, Number(startRow || 1));
  const safeStartCol = Math.max(1, Number(startCol || 1));
  const safeRowCount = Math.max(1, Number(rowCount || 1));
  const safeColCount = Math.max(1, Number(colCount || 1));
  const endRow = safeStartRow + safeRowCount - 1;
  const endCol = safeStartCol + safeColCount - 1;
  const a1Start = `${hddtColumnToA1Label(safeStartCol)}${safeStartRow}`;
  const a1End = `${hddtColumnToA1Label(endCol)}${endRow}`;
  return `${hddtEscapeSheetNameForA1(sheetName)}!${a1Start}:${a1End}`;
}

function hddtPadMatrix(values, rowCount, colCount) {
  const safeRows = Math.max(0, Number(rowCount || 0));
  const safeCols = Math.max(0, Number(colCount || 0));
  const out = [];
  for (let r = 0; r < safeRows; r++) {
    const sourceRow = Array.isArray(values && values[r]) ? values[r] : [];
    const row = [];
    for (let c = 0; c < safeCols; c++) {
      row.push(sourceRow[c] === undefined ? "" : sourceRow[c]);
    }
    out.push(row);
  }
  return out;
}

function hddtLogSheetsV4Fallback(mode, message, extra) {
  try {
    if (typeof hddtLog === "function") {
      hddtLog("WARN", "sheetsV4Fallback", message, {
        mode,
        fallbackLegacy: hddtUseSheetsV4FallbackLegacy(),
        ...(extra || {}),
      });
    }
  } catch (_error) {
    // ignore logging errors
  }
}

function hddtSheetsV4GetValues(sheetName, startRow, startCol, rowCount, colCount, options) {
  const safeRowCount = Math.max(0, Number(rowCount || 0));
  const safeColCount = Math.max(0, Number(colCount || 0));
  if (!safeRowCount || !safeColCount) return [];
  if (!hddtShouldRunSheetsV4("read")) return null;

  const opts = options || {};
  try {
    const spreadsheetId = getEffectiveDatabaseSpreadsheetId();
    const range = hddtBuildA1RangeFromGrid(sheetName, startRow, startCol, safeRowCount, safeColCount);
    const response = Sheets.Spreadsheets.Values.get(spreadsheetId, range, {
      majorDimension: "ROWS",
      valueRenderOption: opts.displayValues ? "FORMATTED_VALUE" : "UNFORMATTED_VALUE",
      dateTimeRenderOption: "FORMATTED_STRING",
    });
    const values = (response && response.values) || [];
    if (opts.pad === false) return values;
    return hddtPadMatrix(values, safeRowCount, safeColCount);
  } catch (error) {
    hddtLogSheetsV4Fallback("read", "Sheets API v4 get failed, fallback to SpreadsheetApp", {
      sheetName,
      startRow,
      startCol,
      rowCount: safeRowCount,
      colCount: safeColCount,
      error: String(error && error.message ? error.message : error),
    });
    if (hddtUseSheetsV4FallbackLegacy()) return null;
    throw error;
  }
}

function hddtSheetsV4BatchGetValues(ranges, options) {
  const list = Array.isArray(ranges) ? ranges : [];
  if (!list.length) return [];
  if (!hddtShouldRunSheetsV4("read")) return null;

  const opts = options || {};
  try {
    const spreadsheetId = getEffectiveDatabaseSpreadsheetId();
    const a1Ranges = list.map((item) =>
      hddtBuildA1RangeFromGrid(item.sheetName, item.startRow, item.startCol, item.rowCount, item.colCount)
    );
    const response = Sheets.Spreadsheets.Values.batchGet(spreadsheetId, {
      ranges: a1Ranges,
      majorDimension: "ROWS",
      valueRenderOption: opts.displayValues ? "FORMATTED_VALUE" : "UNFORMATTED_VALUE",
      dateTimeRenderOption: "FORMATTED_STRING",
    });
    const valueRanges = (response && response.valueRanges) || [];
    return list.map((rangeDef, idx) => {
      const values = (valueRanges[idx] && valueRanges[idx].values) || [];
      if (opts.pad === false) return values;
      return hddtPadMatrix(values, rangeDef.rowCount, rangeDef.colCount);
    });
  } catch (error) {
    hddtLogSheetsV4Fallback("read", "Sheets API v4 batchGet failed, fallback to SpreadsheetApp", {
      rangeCount: list.length,
      error: String(error && error.message ? error.message : error),
    });
    if (hddtUseSheetsV4FallbackLegacy()) return null;
    throw error;
  }
}

function hddtSheetsV4BatchWriteValues(ranges, options) {
  const list = (Array.isArray(ranges) ? ranges : []).filter(
    (item) => item && Array.isArray(item.values) && item.values.length > 0
  );
  if (!list.length) return true;
  if (!hddtShouldRunSheetsV4("write")) return false;

  const opts = options || {};
  try {
    const spreadsheetId = getEffectiveDatabaseSpreadsheetId();
    const data = list.map((item) => ({
      range: hddtBuildA1RangeFromGrid(
        item.sheetName,
        item.startRow,
        item.startCol,
        item.values.length,
        item.values[0] ? item.values[0].length : 1
      ),
      majorDimension: "ROWS",
      values: item.values,
    }));

    Sheets.Spreadsheets.Values.batchUpdate(
      {
        valueInputOption: opts.valueInputOption || "USER_ENTERED",
        data,
      },
      spreadsheetId
    );
    return true;
  } catch (error) {
    hddtLogSheetsV4Fallback("write", "Sheets API v4 batchUpdate failed, fallback to SpreadsheetApp", {
      rangeCount: list.length,
      error: String(error && error.message ? error.message : error),
    });
    if (hddtUseSheetsV4FallbackLegacy()) return false;
    throw error;
  }
}

function hddtSheetsV4ClearValues(sheetName, startRow, startCol, rowCount, colCount) {
  const safeRowCount = Math.max(0, Number(rowCount || 0));
  const safeColCount = Math.max(0, Number(colCount || 0));
  if (!safeRowCount || !safeColCount) return true;
  if (!hddtShouldRunSheetsV4("write")) return false;

  try {
    const spreadsheetId = getEffectiveDatabaseSpreadsheetId();
    const range = hddtBuildA1RangeFromGrid(sheetName, startRow, startCol, safeRowCount, safeColCount);
    Sheets.Spreadsheets.Values.clear({}, spreadsheetId, range);
    return true;
  } catch (error) {
    hddtLogSheetsV4Fallback("write", "Sheets API v4 clear failed, fallback to SpreadsheetApp", {
      sheetName,
      startRow,
      startCol,
      rowCount: safeRowCount,
      colCount: safeColCount,
      error: String(error && error.message ? error.message : error),
    });
    if (hddtUseSheetsV4FallbackLegacy()) return false;
    throw error;
  }
}
