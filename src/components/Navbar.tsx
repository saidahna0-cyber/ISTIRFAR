import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';

interface NavbarProps {
  hasSession: boolean;
  activeView: 'campaign' | 'admin';
  onNavigateView: (view: 'campaign' | 'admin') => void;
  onJumpToSection: (sectionId: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  hasSession,
  activeView,
  onNavigateView,
  onJumpToSection,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNavClick = (sectionId: string) => {
    setMobileMenuOpen(false);
    if (activeView !== 'campaign') {
      onNavigateView('campaign');
      setTimeout(() => onJumpToSection(sectionId), 60);
    } else {
      onJumpToSection(sectionId);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-[#FAF8F3]/95 backdrop-blur-md border-b border-[#E4DFD3]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            onNavigateView('campaign');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="font-display text-2xl font-bold text-[#064E3B] tracking-normal whitespace-nowrap shrink-0"
        >
          حملة الاستغفار
        </a>

        {/* Zone 2: 4 concise single-line text links */}
        <nav
          aria-label="التنقل الرئيسي"
          className="hidden md:flex items-center gap-7 text-sm font-medium text-[#3A4943]"
        >
          <a
            href="#stats"
            onClick={(e) => {
              e.preventDefault();
              handleNavClick('stats');
            }}
            className="hover:text-[#065F46] hover:underline underline-offset-8 decoration-[#B48327] transition-colors whitespace-nowrap shrink-0"
          >
            الإحصائيات
          </a>
          <a
            href="#participants"
            onClick={(e) => {
              e.preventDefault();
              handleNavClick('participants');
            }}
            className="hover:text-[#065F46] hover:underline underline-offset-8 decoration-[#B48327] transition-colors whitespace-nowrap shrink-0"
          >
            المشاركون
          </a>
          <a
            href="#virtues"
            onClick={(e) => {
              e.preventDefault();
              handleNavClick('virtues');
            }}
            className="hover:text-[#065F46] hover:underline underline-offset-8 decoration-[#B48327] transition-colors whitespace-nowrap shrink-0"
          >
            فضل الاستغفار
          </a>
          <a
            href="#about"
            onClick={(e) => {
              e.preventDefault();
              handleNavClick('about');
            }}
            className="hover:text-[#065F46] hover:underline underline-offset-8 decoration-[#B48327] transition-colors whitespace-nowrap shrink-0"
          >
            عن الحملة
          </a>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          {activeView === 'admin' ? (
            <button
              type="button"
              onClick={() => onNavigateView('campaign')}
              className="px-4 py-2 text-sm font-semibold text-white bg-[#065F46] rounded-xl hover:bg-[#044734] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              العودة للحملة
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleNavClick('counter-workspace')}
              className="px-4 py-2 text-sm font-semibold text-white bg-[#065F46] rounded-xl hover:bg-[#044734] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {hasSession ? 'عدّاد الاستغفار' : 'انضم للحملة'}
            </button>
          )}

          <button
            type="button"
            aria-label={mobileMenuOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="md:hidden p-2 rounded-lg text-[#1A2420] hover:bg-[#EFEAE0] transition-colors cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Navigation */}
      {mobileMenuOpen && (
        <nav
          aria-label="قائمة الجوال"
          className="md:hidden border-t border-[#E4DFD3] bg-[#FAF8F3] px-4 py-3 flex flex-col gap-1"
        >
          <button
            type="button"
            onClick={() => handleNavClick('stats')}
            className="text-right px-3 py-2.5 rounded-lg text-sm font-medium text-[#1A2420] hover:bg-[#EFEAE0]"
          >
            الإحصائيات المباشرة
          </button>
          <button
            type="button"
            onClick={() => handleNavClick('counter-workspace')}
            className="text-right px-3 py-2.5 rounded-lg text-sm font-medium text-[#1A2420] hover:bg-[#EFEAE0]"
          >
            {hasSession ? 'عدّادي الشخصي' : 'التسجيل في الحملة'}
          </button>
          <button
            type="button"
            onClick={() => handleNavClick('participants')}
            className="text-right px-3 py-2.5 rounded-lg text-sm font-medium text-[#1A2420] hover:bg-[#EFEAE0]"
          >
            المشاركون في الحملة
          </button>
          <button
            type="button"
            onClick={() => handleNavClick('virtues')}
            className="text-right px-3 py-2.5 rounded-lg text-sm font-medium text-[#1A2420] hover:bg-[#EFEAE0]"
          >
            فضل الاستغفار
          </button>
          <button
            type="button"
            onClick={() => handleNavClick('about')}
            className="text-right px-3 py-2.5 rounded-lg text-sm font-medium text-[#1A2420] hover:bg-[#EFEAE0]"
          >
            عن الحملة
          </button>
        </nav>
      )}
    </header>
  );
};
