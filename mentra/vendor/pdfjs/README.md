pdf.js 5.4.296 (Mozilla, Apache License 2.0 — see LICENSE), from
https://github.com/mozilla/pdf.js/releases/download/v5.4.296/pdfjs-5.4.296-dist.zip
(build/pdf.mjs and build/pdf.worker.mjs, unchanged).

Used only on the phone screen to read the text of PDF books (src/ui/pdf.ts). It is loaded
on demand as a separate chunk, and the worker runs on the main thread (globalThis.pdfjsWorker),
because the Mentra WebView may not allow module workers.
