import { useState, useMemo } from "react";
import {
  Folder,
  FolderOpen,
  ChevronLeft,
  ChevronDown,
  Layers,
  Search,
  CheckCircle2,
  ListFilter,
  Minimize2,
  Maximize2,
  FileText,
  FileSpreadsheet,
  Loader2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CATALOG_TREE_DATA, TreeNode } from "@/lib/catalog-tree";

interface CatalogTreeSidebarProps {
  selectedNodeId: string;
  onSelectNode: (nodeId: string) => void;
  counts: Record<string, number>;
  onClose?: () => void;
  onExportExcel?: (scope: "all" | "selected") => void;
  isExporting?: boolean;
}

export function CatalogTreeSidebar({
  selectedNodeId,
  onSelectNode,
  counts,
  onClose,
  onExportExcel,
  isExporting = false,
}: CatalogTreeSidebarProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(
    new Set(["ordinary", "site_work", "foundations", "structure", "sanitary", "electrical", "elec_panels_group", "elec_low_current_group"])
  );
  const [filterQuery, setFilterQuery] = useState("");

  const toggleExpand = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const expandAll = () => {
    const allIds = new Set<string>();
    function collect(nodes: TreeNode[]) {
      nodes.forEach((n) => {
        allIds.add(n.id);
        if (n.children) collect(n.children);
      });
    }
    collect(CATALOG_TREE_DATA);
    setExpandedNodes(allIds);
  };

  const collapseAll = () => {
    setExpandedNodes(new Set());
  };

  // Node matcher for search
  const isNodeMatching = (node: TreeNode, q: string): boolean => {
    if (!q) return true;
    const cleanQ = q.toLowerCase().trim();
    if (node.label.toLowerCase().includes(cleanQ)) return true;
    if (node.codePrefix && node.codePrefix.includes(cleanQ)) return true;
    if (node.children && node.children.some((child) => isNodeMatching(child, q))) {
      return true;
    }
    return false;
  };

  const renderTree = (nodes: TreeNode[], depth = 0) => {
    return (
      <ul className="space-y-0.5">
        {nodes.map((node) => {
          if (filterQuery && !isNodeMatching(node, filterQuery)) {
            return null;
          }

          const hasChildren = node.children && node.children.length > 0;
          const isExpanded = expandedNodes.has(node.id) || Boolean(filterQuery);
          const isSelected = selectedNodeId === node.id;
          const count = counts[node.id] ?? 0;

          return (
            <li key={node.id} className="select-none">
              <div
                onClick={() => onSelectNode(node.id)}
                style={{ paddingRight: `${depth * 12 + 8}px` }}
                className={`flex items-center justify-between py-1.5 pl-2 pr-2 rounded-md text-xs cursor-pointer transition-colors ${
                  isSelected
                    ? "bg-emerald-100/70 text-emerald-950 font-bold border-r-3 border-emerald-700 shadow-2xs"
                    : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  {hasChildren ? (
                    <button
                      type="button"
                      onClick={(e) => toggleExpand(node.id, e)}
                      className="p-0.5 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5 text-emerald-700" />
                      ) : (
                        <ChevronLeft className="w-3.5 h-3.5 text-slate-400" />
                      )}
                    </button>
                  ) : (
                    <span className="w-3.5" />
                  )}

                  {hasChildren ? (
                    isExpanded ? (
                      <FolderOpen className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <Folder className="w-4 h-4 text-slate-400 shrink-0" />
                    )
                  ) : (
                    <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  )}

                  <span className="truncate text-[11.5px] leading-tight">
                    {node.label}
                  </span>
                </div>

                {count > 0 && (
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full border shrink-0 ${
                      isSelected
                        ? "bg-emerald-200/80 text-emerald-950 border-emerald-400 font-bold"
                        : "bg-slate-100 text-slate-500 border-slate-200"
                    }`}
                  >
                    {count.toLocaleString("ar-EG")}
                  </span>
                )}
              </div>

              {hasChildren && isExpanded && (
                <div className="mr-2 border-r border-slate-200/80 pr-1 mt-0.5">
                  {renderTree(node.children!, depth + 1)}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <aside className="w-full h-full flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
      {/* Header */}
      <div className="p-3 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-emerald-100 text-emerald-800 flex items-center justify-center">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 leading-none">
              فهرس أبواب الكراسة
            </h3>
            <span className="text-[10px] text-slate-500">
              قائمة أسعار 2026 الرسمية
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={expandAll}
            title="توسيع كل الأبواب"
            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded cursor-pointer"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={collapseAll}
            title="طي كل الأبواب"
            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded cursor-pointer"
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Search Input for Tree */}
      <div className="p-2 border-b border-slate-100">
        <div className="relative">
          <Input
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="تصفية الأبواب والفروع..."
            className="h-8 text-xs pr-7 bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400"
          />
          <Search className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          {filterQuery && (
            <button
              onClick={() => setFilterQuery("")}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Show All Items Root Button */}
      <div className="p-2 pb-1">
        <button
          type="button"
          onClick={() => onSelectNode("all")}
          className={`w-full flex items-center justify-between py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            selectedNodeId === "all"
              ? "bg-emerald-700 text-white shadow-xs"
              : "bg-slate-100 hover:bg-slate-200/70 text-slate-800"
          }`}
        >
          <span className="flex items-center gap-2">
            <ListFilter className="w-3.5 h-3.5" />
            <span>عرض كافة بنود الكراسة</span>
          </span>
          <span
            className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
              selectedNodeId === "all"
                ? "bg-emerald-800 text-emerald-100"
                : "bg-white text-slate-600"
            }`}
          >
            {(counts["all"] ?? 5622).toLocaleString("ar-EG")}
          </span>
        </button>
      </div>

      {/* Tree Content */}
      <div className="flex-1 overflow-y-auto p-2 pt-1 scrollbar-thin">
        {renderTree(CATALOG_TREE_DATA)}
      </div>

      {/* Footer Export & Info */}
      <div className="p-2.5 border-t border-slate-200 bg-slate-50 space-y-1.5">
        {onExportExcel && (
          <div className="flex flex-col gap-1.5">
            {selectedNodeId !== "all" && (
              <Button
                type="button"
                size="sm"
                disabled={isExporting}
                onClick={() => onExportExcel("selected")}
                className="w-full h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white gap-1.5 cursor-pointer font-semibold"
              >
                {isExporting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                )}
                <span>
                  تصدير الفرع المحدد Excel ({(counts[selectedNodeId] ?? 0).toLocaleString("ar-EG")})
                </span>
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant={selectedNodeId === "all" ? "default" : "outline"}
              disabled={isExporting}
              onClick={() => onExportExcel("all")}
              className={`w-full h-8 text-xs gap-1.5 cursor-pointer font-semibold ${
                selectedNodeId === "all"
                  ? "bg-emerald-700 hover:bg-emerald-800 text-white"
                  : "bg-white border-slate-300 text-slate-700 hover:bg-slate-100"
              }`}
            >
              {isExporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-3.5 h-3.5" />
              )}
              <span>شيت Excel كامل الكراسة بالتصنيف الشجري</span>
            </Button>
          </div>
        )}
        <div className="text-[10px] text-slate-500 text-center">
          اضغط على أي باب لعرض بنوده المعتمدة أو تصديرها
        </div>
      </div>
    </aside>
  );
}
