# Popup HDDT design QA

## Comparison target

- Source visual truth: `/tmp/codex-clipboard-3ac6c571-f7fc-4c53-b8ae-db45f127dcbb.png` (login) and `/tmp/codex-clipboard-4581ef1e-0f71-4c32-bb6d-9a4e300a459b.png` (post-login selection).
- Implementation: live Google Sheet-bound Apps Script popup, captured in the browser after deployment at 2026-09-19 21:31 ICT.
- Viewport: desktop browser capture, approximately 1487 x 775 CSS pixels; the Apps Script dialog content is 760 x 640 CSS pixels. Source images are 1079 x 749 and 1441 x 943 pixels. No density normalization was needed for reviewing the dialog content rather than browser chrome.
- State captured: initial, signed-out login view with a loaded captcha. The runtime session was not authenticated, so the post-login view cannot be browser-captured without a user-provided login; its layout and transition were syntax-checked but not visually asserted as a live state.

## Full-view evidence

The live login popup shows only the login surface: title, username/password fields, captcha image with refresh action, captcha entry, privacy note, and a single login CTA. The former date range, invoice toggles, and download controls are absent from the initial state. The browser console contained no warnings or errors during the capture.

## Focused review

The focused login form was reviewed against the first source image. The two-column field layout, captcha/value pairing, visual grouping, warm login action, and clear hierarchy are present. A separate focused crop was not needed because all interactive form controls are readable in the full capture.

## Required fidelity surfaces

- Fonts and typography: Arial is retained to match the existing Google Sheet environment; the heading, labels, helper text, and button hierarchy are legible and distinct.
- Spacing and layout rhythm: dialog width was increased to 760px; consistent 20–34px spacing keeps the two-column login form uncluttered.
- Colors and tokens: login uses a restrained warm brown inspired by the reference; download uses green for a separate post-login action. Error, success, and information messages use distinct high-contrast fills.
- Image quality and assets: the sole image is the live GDT captcha SVG/PNG delivered by the API; it is retained as an image and not recreated by CSS or SVG markup.
- Copy and content: login text explicitly states password non-persistence; the post-login screen names invoice type, period, optional details, and the Sheet download action.

## Findings

- [P3] The Apps Script container keeps its native “Tải hóa đơn điện tử” outer title and close control, so it does not exactly duplicate the reference modal chrome. This is intentional: the native Google Sheet dialog supplies the close behavior and avoids a competing in-content close icon.
- [P3] The signed-in selection view is not browser-captured because no credentials or captcha answer were entered during QA. Its transition is implemented on the successful login callback and the same screen is selected automatically when an existing session is valid.

## Primary interactions checked

- Opening the Sheet menu opens the popup.
- Initial state shows the login view only.
- Captcha loads into the redesigned form.
- Refresh captcha and client-side loading/error/success messaging remain wired.
- No console errors were recorded.

## Implementation checklist

- [x] Separate login and post-login views.
- [x] Show the selection controls only after a successful or reusable session.
- [x] Add invoice type and month/quarter/year controls that derive the existing `dateRange` payload.
- [x] Preserve detail-download and maximum-detail controls.
- [x] Verify the signed-out state in the live Sheet popup.

## Comparison history

1. Initial live capture: the login-only form showed no P0/P1/P2 visual issues. No corrective iteration was required.

final result: passed
