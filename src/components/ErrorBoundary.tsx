import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let message = error?.message || 'حدث خطأ غير متوقع في التطبيق.';
    if (message.startsWith('{') && message.includes('operationType')) {
      try {
        const parsed = JSON.parse(message);
        message = `خطأ في صلاحيات قاعدة البيانات (${parsed.operationType || 'read/write'}): يرجى التأكد من تسجيل الدخول بحساب Google المعتمد.`;
      } catch {
        // keep original message
      }
    }
    return { hasError: true, message };
  }

  componentDidCatch(error: Error) {
    console.warn('App ErrorBoundary caught error:', error?.message);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          dir="rtl"
          className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-slate-900"
        >
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-6 shadow-sm text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 mx-auto flex items-center justify-center border border-red-200">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold">تعذر إتمام العملية</h2>
            <p className="text-xs text-slate-600 leading-relaxed">{this.state.message}</p>
            <Button
              onClick={() => window.location.reload()}
              className="gap-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs"
            >
              <RefreshCw className="w-4 h-4" />
              إعادة تحميل المنصة
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
