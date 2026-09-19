function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Hóa đơn điện tử")
    .addItem("Tải dữ liệu…", "hddtShowDialog")
    .addItem("Chuẩn hóa 4 sheet dữ liệu", "hddtPrepareSheets")
    .addToUi();
}
