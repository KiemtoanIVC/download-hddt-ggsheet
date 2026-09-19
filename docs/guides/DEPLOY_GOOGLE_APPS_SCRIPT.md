# Đẩy mã lên Google Apps Script

## Phạm vi dự án

- Đây là Apps Script gắn trực tiếp với Google Sheet, không dùng deployment web app.
- Cấu hình clasp nằm ở [`.clasp.json`](../../.clasp.json): `rootDir` là `src`, `scriptId` là dự án Apps Script đang chạy.
- Chỉ tệp nằm trong `src/` được đẩy lên Apps Script.
- `src/appsscript.json` là manifest. Không tự ý bỏ các OAuth scope hoặc dịch vụ Drive đang được bật.

## Quy trình chuẩn

Thực hiện tại thư mục gốc dự án:

```bash
# 1. Kiểm tra tệp sẽ được clasp theo dõi.
npx --yes @google/clasp@3.2.0 status

# 2. Kiểm tra cú pháp các tệp JavaScript đã sửa.
node --check src/hddt_bound_app.js

# 3. Đẩy mã nguồn hiện tại lên đúng Apps Script đã liên kết.
npx --yes @google/clasp@3.2.0 push

# 4. Xác nhận không còn khác biệt cục bộ.
npx --yes @google/clasp@3.2.0 status
```

Sau khi đẩy, tải lại Google Sheet rồi mở lại **Hóa đơn điện tử → Tải dữ liệu**. Popup Apps Script đang mở trước khi đẩy sẽ giữ mã cũ.

## Popup HĐĐT: bắt buộc tạo bản chạy ES5

`src/HddtDialog.html` là mã nguồn dễ đọc. Apps Script chỉ chạy bản đã biên dịch tại `src/HddtDialogCompiled.html`, được chọn trong `hddtShowDialog()` ở `src/hddt_bound_app.js`.

Mỗi lần thay đổi JavaScript bên trong thẻ `<script>` của `HddtDialog.html`, phải biên dịch lại `HddtDialogCompiled.html` trước khi chạy `clasp push`. Bản chạy ES5 là cần thiết vì trình xử lý HTML của Apps Script có thể không thực thi cú pháp JavaScript hiện đại còn nguyên (như `const`, arrow function, `async/await`).

```bash
# Tạo thư mục công cụ tạm ngoài dự án.
mkdir -p /tmp/hddt-appscript-build
npm install --prefix /tmp/hddt-appscript-build --no-audit --no-fund \
  @babel/core @babel/cli @babel/preset-env

# Tách phần JavaScript từ HTML nguồn và giữ lại khung HTML.
node - <<'NODE'
const fs = require('fs');
const source = fs.readFileSync('src/HddtDialog.html', 'utf8');
const start = source.indexOf('<script>');
const end = source.lastIndexOf('</script>');
if (start < 0 || end < 0) throw new Error('Không tìm thấy script popup');
fs.writeFileSync('/tmp/hddt-dialog-client.js', source.slice(start + '<script>'.length, end));
fs.writeFileSync('/tmp/hddt-dialog-prefix.html', source.slice(0, start + '<script>'.length));
fs.writeFileSync('/tmp/hddt-dialog-suffix.html', source.slice(end));
NODE

# Biên dịch JavaScript về ES5.
printf '%s\n' '{"presets":[["/tmp/hddt-appscript-build/node_modules/@babel/preset-env",{"targets":{"ie":"11"}}]]}' \
  > /tmp/hddt-babel-config.json
/tmp/hddt-appscript-build/node_modules/.bin/babel \
  /tmp/hddt-dialog-client.js \
  --out-file /tmp/hddt-dialog-client.es5.js \
  --config-file /tmp/hddt-babel-config.json

# Ghép lại thành tệp HTML chạy trên Apps Script.
node - <<'NODE'
const fs = require('fs');
fs.writeFileSync(
  'src/HddtDialogCompiled.html',
  fs.readFileSync('/tmp/hddt-dialog-prefix.html', 'utf8') + '\n' +
    fs.readFileSync('/tmp/hddt-dialog-client.es5.js', 'utf8') + '\n' +
    fs.readFileSync('/tmp/hddt-dialog-suffix.html', 'utf8'),
);
NODE

node --check /tmp/hddt-dialog-client.es5.js
npx --yes @google/clasp@3.2.0 push
```

Không sửa trực tiếp `HddtDialogCompiled.html`; thay đổi ở tệp này sẽ bị ghi đè khi biên dịch lại.

## Kiểm tra captcha HĐĐT

- Captcha gọi trực tiếp từ iframe của Apps Script tới `https://hoadondientu.gdt.gov.vn/api/captcha`.
- API hiện trả SVG. Popup chuyển SVG thành Blob URL để hiển thị; không thay lại thành ảnh `data:`.
- Không chuyển việc lấy captcha hoặc xuất Excel về `UrlFetchApp`: máy chủ HĐĐT có thể chặn địa chỉ của Apps Script với lỗi “Địa chỉ không khả dụng”.
- Không nhập mật khẩu, mã captcha hoặc xác thực thay người dùng khi kiểm thử.

## Lưu ý về đồng bộ và phục hồi

- `clasp push` cập nhật tệp hiện có, nhưng không phải là cơ chế xóa tệp đã tồn tại trên Apps Script. Xóa tệp từ xa chỉ thực hiện khi có yêu cầu rõ ràng và sau khi xác nhận đúng tệp cần xóa.
- Không chạy `clasp pull` để ghi đè thư mục làm việc khi chưa kiểm tra thay đổi cục bộ. Không có Git repository hoặc Apps Script version đã tạo để tự động phục hồi mã cũ.
- Với lỗi khi chạy, xem **Apps Script → Thực thi** để phân biệt lỗi của mã máy chủ và lỗi JavaScript trong popup.
