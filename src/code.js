function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Hóa đơn điện tử")
    .addItem("Tải dữ liệu…", "hddtShowDialog")
    .addItem("Khởi tạo schema HDDT mới", "hddtPrepareSheets")
    .addItem("Tái cấu trúc: xóa 5 tab HDDT cũ…", "hddtMigrateToEtaxSchema")
    .addToUi();
}
