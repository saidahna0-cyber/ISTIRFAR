import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

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
    let readable = 'حدث خطأ غير متوقع أثناء تشغيل المنصة.';
    try {
      const parsed = JSON.parse(error.message) as { error?: string };
      if (parsed?.error) {
        readable = parsed.error.includes('permission')
          ? 'تعذر إتمام العملية بسبب قيود الصلاحيات في قاعدة البيانات.'
          : parsed.error;
      }
    } catch {
      if (error.message) readable = error.message;
    }
    return { hasError: true, message: readable };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          dir="rtl"
          className="min-h-screen bg-[#FAF8F3] flex items-center justify-center p-6"
        >
          <div className="max-w-md w-full bg-white border border-[#E4DFD3] rounded-2xl p-8 text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-[#1A2420] mb-2">
              تنبيه تقني
            </h1>
            <p className="text-sm text-[#53615B] leading-relaxed mb-6">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#065F46] text-white text-sm font-semibold hover:bg-[#044734] transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>إعادة تحميل الصفحة</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
