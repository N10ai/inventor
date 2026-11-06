# Inventor

A mobile-friendly warehouse receiving app for reviewing packing lists, counting mixed pallets, and reconciling inventory without repeating data entry.

## Run

```sh
npm ci
npm run dev
```

```sh
npm test
npm run build
npm run preview
```

Requires Node 22+ for development. Use HTTPS in production. Deployment output is `dist/`; no server secrets are required.

## Working workflow

1. Create a receiving job with customer, reference, and pallet count.
2. Upload a PDF, XLSX, CSV, TSV, TXT, or JPG/PNG/WebP image (maximum 25 MB). XLSX worksheets are selectable. Text PDFs extract directly; scanned pages and images use English OCR. Legacy XLS files must be saved as XLSX or CSV first.
3. Review column mappings and editable extracted rows. Remove headings/totals, correct OCR errors, then accept. Nothing becomes physical stock merely because it appears on a packing list. Re-importing the same filename and worksheet replaces that source's imported rows rather than doubling them.
4. Count on each pallet using a keyboard barcode scanner or typed part numbers. Add packages × units, lot, UOM, condition, and notes. Repeated entries add quantities; individual entries can be corrected or removed. A lot from the list is a suggestion; verify it against the cargo.
5. Reconcile totals by normalized **part number + lot + UOM** across every pallet. Different lots and units never combine. Under-counts become final shortages only after all pallets are marked complete. Completed pallets must be reopened before changing their counts.
6. Export reconciliation CSV, detailed pallet-count CSV, or a printable customer report (print to PDF). Export/restore JSON backups for transfer or recovery.

An explicitly labeled 24-pallet sample job is available from the empty state. It never populates a real job automatically.

## Storage and boundaries

This first version saves structured job data in IndexedDB **on the current browser/device**. It does not synchronize between people or devices and has no user accounts. Clearing browser storage removes that local data; export backups regularly. The original uploaded file is processed in memory, not retained, and its filename/method/reviewed rows are recorded. Printed reports contain customer details; handle exports appropriately.

Document processing runs locally in the browser. OCR downloads its worker, WebAssembly, and English language model when first used, so it requires an internet connection. Packing lists vary: heuristic text extraction and OCR are not a universal AI table-recognition service. Always review part numbers, quantities, lots, and units before accepting. Cloud AI extraction, retained original documents, photos, shared sessions, roles, and durable server storage are future integration work.

## Structure

- `src/app.js`: workspace, receiving jobs, import review, counting, reporting.
- `src/core.js`: reconciliation, unit-safe totals, and CSV generation.
- `src/parsing.js`: column inference and text-to-row parsing.
- `src/importer.js`: lazy-loaded PDF.js, ExcelJS, Papa Parse, and Tesseract document processing.
- `src/storage.js`: transactional IndexedDB persistence.
- `tests/`: 24-pallet aggregation, lot/UOM isolation, provisional/final shortages, overages, CSV safety, quantity validation, and packing-list parsing.

## Next production step

Add authenticated team storage and append-only count events before simultaneous use by multiple warehouse employees. Keep job, physical pallet, count entry, imported expected line, and source document as separate records; aggregate counts by part/lot/UOM instead of editing one global stock number.
