function hddtLog(level, action, message, meta) {
  try {
    const sheet = hddtGetOrCreateSheet(HDDT_SHEETS.LOG, HDDT_HEADERS.log);
    sheet.appendRow([
      hddtNowIso(),
      level || "INFO",
      action || "unknown",
      message || "",
      meta ? JSON.stringify(meta) : "",
    ]);
  } catch (error) {
    console.log("[HDDT_LOG_ERROR]", error);
  }
}
