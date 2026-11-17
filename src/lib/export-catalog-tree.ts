import ExcelJS from "exceljs";
import {
  CATALOG_TREE_DATA,
  computeTreeCounts,
  findTreeNodeById,
  resolveItemTreePath,
  type TreeNode,
} from "./catalog-tree";

export interface CatalogExportItem {
  id: number;
  code: string;
  desc: string;
  unit: string;
  rate: number;
  part: string;
  page: number;
  section?: string;
}

const THIN_BORDER: Partial<ExcelJS.Border> = { style: "thin", color: { argb: "FFD0D7DE" } };
const BOX_BORDER: Partial<ExcelJS.Borders> = {
  top: THIN_BORDER,
  left: THIN_BORDER,
  right: THIN_BORDER,
  bottom: THIN_BORDER,
};

const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF047857" } };
const LEVEL1_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD1FAE5" } };
const LEVEL2_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
const ZEBRA_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };

export async function buildCatalogTreeWorkbook(
  items: CatalogExportItem[],
  selectedNodeId: string = "all"
): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "منصة إعداد المقايسات الهندسية — الهيئة العامة للأبنية التعليمية";
  wb.created = new Date();
  wb.views = [{ x: 0, y: 0, width: 20000, height: 15000, firstSheet: 0, activeTab: 0, visibility: "visible" }];

  const counts = computeTreeCounts(items);
  const selectedNode = selectedNodeId !== "all" ? findTreeNodeById(selectedNodeId) : null;
  const scopeTitle = selectedNode ? selectedNode.label : "كامل كراسة الأسعار 2026 (جميع الأبواب)";

  // ==========================================================
  // SHEET 1: الفهرس الشجري الهرمي (Hierarchical Tree Summary)
  // ==========================================================
  const treeSheet = wb.addWorksheet("الفهرس الشجري", {
    views: [{ rightToLeft: true, showGridLines: true, state: "frozen", ySplit: 3 }],
    pageSetup: {
      paperSize: 9,
      orientation: "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });

  treeSheet.columns = [
    { width: 8 },  // م
    { width: 16 }, // المستوى
    { width: 58 }, // القسم / الباب / الفرع
    { width: 20 }, // بادئة الكود
    { width: 14 }, // عدد البنود
  ];

  // Title banner
  treeSheet.mergeCells("A1:E1");
  const titleCell1 = treeSheet.getCell("A1");
  titleCell1.value = "الفهرس الشجري الهرمي لكراسة أسعار الهيئة العامة للأبنية التعليمية — 2026";
  titleCell1.font = { name: "Arial", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
  titleCell1.fill = HEADER_FILL;
  titleCell1.alignment = { horizontal: "center", vertical: "middle", readingOrder: "rtl" };
  treeSheet.getRow(1).height = 34;

  treeSheet.mergeCells("A2:E2");
  const subTitleCell1 = treeSheet.getCell("A2");
  subTitleCell1.value = `النطاق المُصدّر: ${scopeTitle} — إجمالي البنود: ${items.length.toLocaleString("ar-EG")} بنداً`;
  subTitleCell1.font = { name: "Arial", size: 11, bold: true, color: { argb: "FF065F46" } };
  subTitleCell1.fill = LEVEL1_FILL;
  subTitleCell1.alignment = { horizontal: "center", vertical: "middle", readingOrder: "rtl" };
  treeSheet.getRow(2).height = 26;

  // Table headers row 3
  const treeHeaders = ["م", "المستوى التنظيمي", "القسم الرئيسي / الباب / الفرع التخصصي", "بادئة الكود", "عدد البنود"];
  const hdrRow1 = treeSheet.getRow(3);
  hdrRow1.height = 28;
  treeHeaders.forEach((h, i) => {
    const c = hdrRow1.getCell(i + 1);
    c.value = h;
    c.font = { name: "Arial", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    c.alignment = { horizontal: "center", vertical: "middle", readingOrder: "rtl" };
    c.border = BOX_BORDER;
  });

  let treeRowIdx = 4;
  let treeSeq = 1;

  const writeTreeRows = (nodes: TreeNode[], level: number) => {
    for (const node of nodes) {
      const nodeCount = counts[node.id] ?? 0;
      const row = treeSheet.getRow(treeRowIdx);
      row.height = level === 1 ? 26 : 22;

      const indentPrefix = level === 1 ? "" : level === 2 ? "   ↳ " : "       • ";
      const levelName = level === 1 ? "قسم رئيسي" : level === 2 ? "باب / مجموعة" : "فصل فرعي";
      const codeStr = node.codePrefix || (node.codePrefixes ? node.codePrefixes.join(" , ") : "—");

      row.getCell(1).value = treeSeq++;
      row.getCell(2).value = levelName;
      row.getCell(3).value = `${indentPrefix}${node.label}`;
      row.getCell(4).value = codeStr;
      row.getCell(5).value = nodeCount;
      row.getCell(5).numFmt = "#,##0";

      for (let col = 1; col <= 5; col++) {
        const c = row.getCell(col);
        c.border = BOX_BORDER;
        c.font = {
          name: "Arial",
          size: level === 1 ? 11 : 10,
          bold: level === 1 || (level === 2 && Boolean(node.children?.length)),
          color: { argb: level === 1 ? "FF064E3B" : "FF0F172A" },
        };
        c.alignment = {
          horizontal: col === 3 ? "right" : "center",
          vertical: "middle",
          readingOrder: "rtl",
          wrapText: true,
        };
        if (level === 1) c.fill = LEVEL1_FILL;
        else if (level === 2 && node.children?.length) c.fill = LEVEL2_FILL;
      }

      treeRowIdx++;
      if (node.children && node.children.length > 0) {
        writeTreeRows(node.children, level + 1);
      }
    }
  };

  writeTreeRows(CATALOG_TREE_DATA, 1);

  // ==========================================================
  // SHEET 2: جدول البنود بالتصنيف الشجري
  // ==========================================================
  const itemsSheet = wb.addWorksheet("البنود بالتصنيف الشجري", {
    views: [{ rightToLeft: true, showGridLines: true, state: "frozen", ySplit: 3 }],
    pageSetup: {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });

  itemsSheet.columns = [
    { width: 8 },  // A: م
    { width: 15 }, // B: كود البند
    { width: 28 }, // C: القسم الرئيسي
    { width: 34 }, // D: الباب / المجموعة
    { width: 38 }, // E: الفرع الشجري التخصصي
    { width: 65 }, // F: بيان الأعمال
    { width: 11 }, // G: الوحدة
    { width: 14 }, // H: الفئة (ج.م)
    { width: 10 }, // I: الصفحة
  ];

  itemsSheet.mergeCells("A1:I1");
  const banner = itemsSheet.getCell("A1");
  banner.value = `بنود كراسة أسعار الهيئة العامة للأبنية التعليمية 2026 — مصنفة بالتصنيف الشجري (${items.length.toLocaleString("ar-EG")} بنداً)`;
  banner.font = { name: "Arial", size: 13, bold: true, color: { argb: "FFFFFFFF" } };
  banner.fill = HEADER_FILL;
  banner.alignment = { horizontal: "center", vertical: "middle", readingOrder: "rtl" };
  itemsSheet.getRow(1).height = 32;

  itemsSheet.mergeCells("A2:I2");
  const subBanner = itemsSheet.getCell("A2");
  subBanner.value = `النطاق: ${scopeTitle} | تاريخ التصدير: ${new Date().toLocaleDateString("ar-EG")}`;
  subBanner.font = { name: "Arial", size: 10, bold: true, color: { argb: "FF065F46" } };
  subBanner.fill = LEVEL1_FILL;
  subBanner.alignment = { horizontal: "center", vertical: "middle", readingOrder: "rtl" };
  itemsSheet.getRow(2).height = 24;

  const itemHeaders = [
    "م",
    "كود البند",
    "القسم الرئيسي",
    "الباب / المجموعة",
    "الفرع الشجري التخصصي",
    "بيان الأعمال (التوصيف الكامل)",
    "الوحدة",
    "الفئة (ج.م)",
    "الصفحة",
  ];
  const itemHdrRow = itemsSheet.getRow(3);
  itemHdrRow.height = 28;
  itemHeaders.forEach((h, i) => {
    const c = itemHdrRow.getCell(i + 1);
    c.value = h;
    c.font = { name: "Arial", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    c.alignment = { horizontal: "center", vertical: "middle", readingOrder: "rtl", wrapText: true };
    c.border = BOX_BORDER;
  });

  // Pre-build reusable styles for item rows
  const fontNormal: Partial<ExcelJS.Font> = { name: "Arial", size: 10 };
  const fontBold: Partial<ExcelJS.Font> = { name: "Arial", size: 10, bold: true };
  const alignCenter: Partial<ExcelJS.Alignment> = { horizontal: "center", vertical: "middle", readingOrder: "rtl", wrapText: true };
  const alignRight: Partial<ExcelJS.Alignment> = { horizontal: "right", vertical: "middle", readingOrder: "rtl", wrapText: true };

  // Sort items canonically by section & code before writing
  const sortedItems = [...items].sort((a, b) => {
    const pa = resolveItemTreePath(a);
    const pb = resolveItemTreePath(b);
    return pa.canonicalCode.localeCompare(pb.canonicalCode, "en");
  });

  let rowIdx = 4;
  for (let idx = 0; idx < sortedItems.length; idx++) {
    const it = sortedItems[idx];
    const path = resolveItemTreePath(it);
    const row = itemsSheet.getRow(rowIdx);
    row.height = it.desc.length > 180 ? 48 : it.desc.length > 90 ? 34 : 24;

    row.getCell(1).value = idx + 1;
    row.getCell(2).value = path.canonicalCode;
    row.getCell(3).value = path.sectionLabel;
    row.getCell(4).value = path.chapterLabel;
    row.getCell(5).value = path.branchLabel;
    row.getCell(6).value = it.desc;
    row.getCell(7).value = it.unit;
    row.getCell(8).value = Number(it.rate) || 0;
    row.getCell(8).numFmt = "#,##0.00";
    row.getCell(9).value = it.page || "";

    const isEven = idx % 2 === 1;
    for (let col = 1; col <= 9; col++) {
      const c = row.getCell(col);
      c.border = BOX_BORDER;
      c.font = col === 2 || col === 8 ? fontBold : fontNormal;
      c.alignment = col === 3 || col === 4 || col === 5 || col === 6 ? alignRight : alignCenter;
      if (isEven) c.fill = ZEBRA_FILL;
    }
    rowIdx++;
  }

  // Enable AutoFilter across all columns
  itemsSheet.autoFilter = {
    from: { row: 3, column: 1 },
    to: { row: Math.max(3, rowIdx - 1), column: 9 },
  };
  itemsSheet.pageSetup.printTitlesRow = "1:3";

  return wb;
}

export async function exportCatalogTreeExcel(
  items: CatalogExportItem[],
  selectedNodeId: string = "all"
): Promise<void> {
  const wb = await buildCatalogTreeWorkbook(items, selectedNodeId);
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const suffix = selectedNodeId === "all" ? "كامل_الكراسة" : selectedNodeId.replace(/\//g, "-");
  a.download = `بنود_الكراسة_بالتصنيف_الشجري_${suffix}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
