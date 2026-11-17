import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Calculator,
  Plus,
  Trash2,
  X,
  Check,
  RotateCcw,
  Ruler,
  AlertCircle,
  FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";
import { fmt } from "@/lib/estimate-utils";

export interface TakeoffRow {
  id: string;
  description: string;
  count: number;
  length: number;
  width: number;
  height: number;
  isDeduction: boolean;
}

interface TakeoffModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: {
    id: number;
    code: string;
    desc: string;
    unit: string;
    rate: number;
    qty: number;
    takeoff?: TakeoffRow[];
  } | null;
  onSaveTakeoff: (itemId: number, newQty: number, takeoffRows: TakeoffRow[]) => void;
}

export function TakeoffModal({
  isOpen,
  onClose,
  item,
  onSaveTakeoff,
}: TakeoffModalProps) {
  const [rows, setRows] = useState<TakeoffRow[]>([]);

  useEffect(() => {
    if (item) {
      if (item.takeoff && item.takeoff.length > 0) {
        setRows(item.takeoff);
      } else {
        // Initialize with default single row with the current quantity
        setRows([
          {
            id: `tr_${Date.now()}_1`,
            description: "كمية أساسية تقديرية",
            count: 1,
            length: item.qty || 1,
            width: 1,
            height: 1,
            isDeduction: false,
          },
        ]);
      }
    }
  }, [item]);

  if (!isOpen || !item) return null;

  const calculateRowTotal = (r: TakeoffRow): number => {
    const c = r.count > 0 ? r.count : 1;
    const l = r.length > 0 ? r.length : 1;
    const w = r.width > 0 ? r.width : 1;
    const h = r.height > 0 ? r.height : 1;
    const total = c * l * w * h;
    return Math.round(total * 100) / 100;
  };

  const handleAddRow = () => {
    setRows((prev) => [
      ...prev,
      {
        id: `tr_${Date.now()}_${prev.length + 1}`,
        description: "",
        count: 1,
        length: 1,
        width: 1,
        height: 1,
        isDeduction: false,
      },
    ]);
  };

  const handleRemoveRow = (id: string) => {
    if (rows.length <= 1) {
      return toast.info("يجب الإبقاء على سطر قياس واحد على الأقل");
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleUpdateRow = (id: string, field: keyof TakeoffRow, value: any) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  // Compute Totals
  let additionTotal = 0;
  let deductionTotal = 0;

  rows.forEach((r) => {
    const sub = calculateRowTotal(r);
    if (r.isDeduction) {
      deductionTotal += sub;
    } else {
      additionTotal += sub;
    }
  });

  const netQty = Math.max(0, Math.round((additionTotal - deductionTotal) * 100) / 100);
  const totalAmount = netQty * item.rate;

  const handleSave = () => {
    if (netQty <= 0) {
      return toast.error("صافي الكمية المحسوبة يجب أن يكون أكبر من الصفر");
    }
    onSaveTakeoff(item.id, netQty, rows);
    toast.success(`تم تحديث كمية البند إلى (${netQty.toLocaleString("ar-EG")} ${item.unit})`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-3 sm:p-4 font-sans">
      <Card className="w-full max-w-4xl bg-white border border-slate-200 shadow-2xl p-5 sm:p-6 relative max-h-[92vh] flex flex-col rounded-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b pb-4 mb-4 gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-200">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  شيت حصر الكميات الهندسي التفصيلي
                </h2>
                <Badge variant="outline" className="font-mono text-xs border-emerald-300 text-emerald-800 bg-emerald-50">
                  كود: {item.code}
                </Badge>
                <Badge variant="outline" className="text-xs border-slate-300 text-slate-700">
                  الوحدة: {item.unit}
                </Badge>
              </div>
              <p className="text-xs text-slate-600 line-clamp-2 mt-1 leading-relaxed">
                {item.desc}
              </p>
            </div>
          </div>

          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full text-slate-500 hover:text-slate-800">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Calculation Action Bar */}
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handleAddRow}
              className="h-8 gap-1.5 text-xs bg-emerald-700 hover:bg-emerald-800 text-white shadow-2xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              إضافة سطر قياس
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setRows([
                  {
                    id: `tr_${Date.now()}`,
                    description: "",
                    count: 1,
                    length: 1,
                    width: 1,
                    height: 1,
                    isDeduction: false,
                  },
                ]);
              }}
              className="h-8 gap-1.5 text-xs border-slate-300 text-slate-600 hover:text-slate-900"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              تفريغ الأبعاد
            </Button>
          </div>

          <div className="text-[11px] text-slate-500">
            معادلة الحساب: <strong>العدد × الطول × العرض × الارتفاع</strong>
          </div>
        </div>

        {/* Takeoff Table */}
        <div className="flex-1 overflow-auto border border-slate-200 rounded-xl mb-4">
          <table className="w-full text-right text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-700 sticky top-0 border-b border-slate-200 font-semibold">
              <tr>
                <th className="p-2.5 w-10 text-center">م</th>
                <th className="p-2.5 min-w-[160px]">بيان الموضع / تفاصيل العنصر</th>
                <th className="p-2.5 w-16 text-center">العدد</th>
                <th className="p-2.5 w-20 text-center">الطول (م)</th>
                <th className="p-2.5 w-20 text-center">العرض (م)</th>
                <th className="p-2.5 w-20 text-center">الارتفاع (م)</th>
                <th className="p-2.5 w-24 text-center">نوع السطر</th>
                <th className="p-2.5 w-24 text-center">الكمية الجزئية</th>
                <th className="p-2.5 w-12 text-center">حذف</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, idx) => {
                const subTotal = calculateRowTotal(row);

                return (
                  <tr
                    key={row.id}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      row.isDeduction ? "bg-red-50/40 text-red-900" : ""
                    }`}
                  >
                    <td className="p-2 text-center font-mono text-slate-500">
                      {idx + 1}
                    </td>

                    <td className="p-1.5">
                      <Input
                        value={row.description}
                        onChange={(e) => handleUpdateRow(row.id, "description", e.target.value)}
                        placeholder="مثال: قواعد ق1، سقف الدور، حائط الفناء..."
                        className="h-8 text-xs bg-white border-slate-200 text-slate-900 placeholder:text-slate-400"
                      />
                    </td>

                    <td className="p-1.5">
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={row.count || ""}
                        onChange={(e) => handleUpdateRow(row.id, "count", parseFloat(e.target.value) || 0)}
                        className="h-8 text-xs text-center font-mono bg-white border-slate-200"
                      />
                    </td>

                    <td className="p-1.5">
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={row.length || ""}
                        onChange={(e) => handleUpdateRow(row.id, "length", parseFloat(e.target.value) || 0)}
                        className="h-8 text-xs text-center font-mono bg-white border-slate-200"
                      />
                    </td>

                    <td className="p-1.5">
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={row.width || ""}
                        onChange={(e) => handleUpdateRow(row.id, "width", parseFloat(e.target.value) || 0)}
                        className="h-8 text-xs text-center font-mono bg-white border-slate-200"
                      />
                    </td>

                    <td className="p-1.5">
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={row.height || ""}
                        onChange={(e) => handleUpdateRow(row.id, "height", parseFloat(e.target.value) || 0)}
                        className="h-8 text-xs text-center font-mono bg-white border-slate-200"
                      />
                    </td>

                    <td className="p-1.5 text-center">
                      <select
                        value={row.isDeduction ? "deduct" : "add"}
                        onChange={(e) =>
                          handleUpdateRow(row.id, "isDeduction", e.target.value === "deduct")
                        }
                        className={`text-xs h-8 px-1.5 rounded-md border font-semibold ${
                          row.isDeduction
                            ? "bg-red-100 text-red-800 border-red-300"
                            : "bg-emerald-50 text-emerald-800 border-emerald-300"
                        }`}
                      >
                        <option value="add">إضافة (+)</option>
                        <option value="deduct">خصم (-)</option>
                      </select>
                    </td>

                    <td className="p-2 text-center font-mono font-bold text-xs">
                      <span className={row.isDeduction ? "text-red-700" : "text-emerald-800"}>
                        {row.isDeduction ? `- ${subTotal.toLocaleString("ar-EG")}` : `+ ${subTotal.toLocaleString("ar-EG")}`}
                      </span>
                    </td>

                    <td className="p-1.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(row.id)}
                        className="p-1 text-slate-400 hover:text-red-600 rounded cursor-pointer"
                        title="حذف هذا السطر"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Live Calculation Summary Footer */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="border-l border-slate-200 pl-2">
              <span className="text-[11px] text-slate-500 block">إجمالي الإضافات (+)</span>
              <span className="text-sm font-bold font-mono text-emerald-700">
                {additionTotal.toLocaleString("ar-EG")} {item.unit}
              </span>
            </div>

            <div className="border-l border-slate-200 pl-2">
              <span className="text-[11px] text-slate-500 block">إجمالي الخصومات (-)</span>
              <span className="text-sm font-bold font-mono text-red-600">
                {deductionTotal.toLocaleString("ar-EG")} {item.unit}
              </span>
            </div>

            <div className="border-l border-slate-200 pl-2">
              <span className="text-[11px] text-slate-500 block">صافي الكمية المحسوبة</span>
              <span className="text-base font-extrabold font-mono text-slate-900 bg-emerald-100/50 px-2 py-0.5 rounded">
                {netQty.toLocaleString("ar-EG")} {item.unit}
              </span>
            </div>

            <div>
              <span className="text-[11px] text-slate-500 block">القيمة المالية الإجمالية</span>
              <span className="text-sm font-bold font-mono text-slate-900">
                {fmt(totalAmount)} ج.م
              </span>
            </div>
          </div>
        </div>

        {/* Modal Buttons */}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <Ruler className="w-4 h-4 text-emerald-600" />
            <span>سيتم تحديث كمية البند تلقائياً وحفظ أبعاد الحصر مع المقايسة</span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose} className="border-slate-300 text-xs">
              إلغاء
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs gap-1.5 font-semibold px-4 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              تطبيق وتحديث كمية البند ({netQty.toLocaleString("ar-EG")} {item.unit})
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
