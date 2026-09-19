# Hướng dẫn làm việc trong dự án

## Triển khai Google Apps Script

Trước khi sửa, kiểm thử hoặc đẩy bất kỳ tệp nào trong `src/`, phải đọc toàn bộ [hướng dẫn triển khai Google Apps Script](docs/guides/DEPLOY_GOOGLE_APPS_SCRIPT.md).

Tuân thủ đặc biệt các quy tắc sau:

- Dự án gắn với Google Sheet qua `.clasp.json`; chỉ đẩy bằng `npx --yes @google/clasp@3.2.0 push` từ thư mục gốc.
- Sau khi sửa JavaScript của `src/HddtDialog.html`, phải biên dịch lại `src/HddtDialogCompiled.html` sang ES5 rồi mới đẩy.
- Không dùng `UrlFetchApp` cho captcha hoặc dữ liệu HĐĐT khi luồng trình duyệt đã được cấu hình, vì máy chủ HĐĐT có thể chặn IP Apps Script.
- Không chạy `clasp pull` hoặc xóa tệp Apps Script từ xa nếu không có yêu cầu rõ ràng.
- Sau mỗi lần đẩy, xác nhận bằng `clasp status` và tải lại Sheet để kiểm thử popup mới.

## Tra cứu chéo etax-manager khi lỗi HĐĐT

Khi luồng HĐĐT trong Google Sheets bị lỗi hoặc có hành vi khác với kỳ vọng, phải
đối chiếu mã đã vận hành ở `/home/duyhiep/Project/etax-manager` trước khi tự
đổi endpoint, tham số, header hoặc mapping. Không suy đoán tên endpoint theo
`purchase`/`sold`: HĐĐT có các tên endpoint không trực quan nhưng đã được kiểm
chứng, ví dụ `purchase` dùng `export-excel-sold`.

Tra cứu theo loại lỗi:

- Endpoint, query parameters, `invoiceKey`, header xác thực, `request-id`,
  timeout và retry/backoff: đọc
  `/home/duyhiep/Project/etax-manager/backend/src/lib/hddt-client.ts`.
  Các điểm cần tìm bằng `rg`: `getSummaryEndpoint`, `getDetailEndpoint`,
  `parseInvoiceKey`, `requestWithRetry`, `buildAuthorizedHeaders`,
  `fetchHddtSummaryExcel` và `fetchHddtInvoiceDetail`.
- Dòng tiêu đề Excel, mapping bảng kê, mapping dòng chi tiết, cache và nhịp
  tải detail: đọc
  `/home/duyhiep/Project/etax-manager/backend/src/services/hddt.service.ts`.
  Các điểm cần tìm: `parseWorkbookRows`, `mapSummaryRow`,
  `fetchAndPersistDetail`, `HDDT_DETAIL_REQUEST_DELAY_MS` và
  `HDDT_DETAIL_MAX_429_RETRIES`.
- Giải thích nghiệp vụ và ma trận endpoint/TTXLY: đọc
  `/home/duyhiep/Project/etax-manager/docs/HDDT_SUMMARY_FEATURE_GUIDE.md` và
  `/home/duyhiep/Project/etax-manager/docs/plans/PHASE_HDDT_ETAX_PORT_IMPLEMENTATION_PLAN.md`.

Quy trình đối chiếu:

1. Xác định hàm đang chạy phía Sheet bằng `rg` trong `src/`.
2. Tìm hàm cùng vai trò ở hai tệp nguồn `etax-manager` nêu trên.
3. So sánh đầy đủ endpoint, query, thứ tự các phần của `invoiceKey`, headers,
   điều kiện retry và cách xử lý response không phải JSON; không chỉ so sánh
   tên hàm.
4. Port thay đổi tối thiểu sang `src/`, rồi thực hiện kiểm tra và triển khai
   theo mục **Triển khai Google Apps Script**.
