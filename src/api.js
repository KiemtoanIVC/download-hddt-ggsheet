const setDatabaseSpreadsheetId = (spreadsheetId) => {
  const normalized = String(spreadsheetId || "").trim();
  if (!normalized) {
    throw new Error("spreadsheetId is required");
  }
  throw new Error(
    "Bound-only mode: không cho đổi Spreadsheet ID. Hãy mở Apps Script từ đúng file Google Sheet."
  );
};

const getDatabaseSpreadsheetId = () => {
  return "";
};

const getBoundSpreadsheet = () => {
  try {
    return SpreadsheetApp.getActiveSpreadsheet() || null;
  } catch (_error) {
    return null;
  }
};

const getEffectiveDatabaseSpreadsheetId = () => {
  const bound = getBoundSpreadsheet();
  if (bound) return bound.getId();

  throw new Error(
    "Bound-only mode: không tìm thấy Active Spreadsheet. Hãy chạy project dưới dạng bound script."
  );
};

const getDatabaseSpreadsheet = () => {
  const bound = getBoundSpreadsheet();
  if (bound) return bound;

  throw new Error(
    "Bound-only mode: không tìm thấy Active Spreadsheet. Hãy mở Apps Script từ đúng file Google Sheet."
  );
};

const getSheetData = (name) => {
  const ss = getDatabaseSpreadsheet();
  const sheet = ss.getSheetByName(name);
  if (!sheet) {
    throw new Error(`Sheet not found: ${name}`);
  }
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow <= 1 || lastCol <= 0) {
    return JSON.stringify([]);
  }
  const data = hddtReadSheetMatrix(name, 1, 1, lastRow, lastCol, {
    displayValues: true,
    pad: true,
  });
  const heads = (data.shift() || []).map((h) => String(h || "").trim());
  const obj = data.map((r) =>
    heads.reduce((o, k, i) => {
      if (!k) return o;

      o[k] = r[i] || "";
      return o;
    }, {})
  );
  return JSON.stringify(obj);
};

const getSheetNamesAndHeaders = () => {
  const ss = getDatabaseSpreadsheet();
  const sheets = ss.getSheets();
  const sheetNames = sheets.map((sheet) => sheet.getName());
  
  const headers = sheets.map((sheet) => {
    const values = hddtReadSheetMatrix(sheet.getName(), 1, 1, 1, Math.max(1, sheet.getLastColumn()), {
      displayValues: false,
      pad: true,
    });
    const headers = ((values[0] || []) || []).map((h) =>
      String(h || "").trim()
    );
    return { [sheet.getName()]: headers };
  });

  return { sheetNames, headers };
}
