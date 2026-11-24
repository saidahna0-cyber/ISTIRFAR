import React, { useState } from 'react';
import { Check, Copy, Share2 } from 'lucide-react';

interface QuranVerse {
  surah: string;
  ayahNumber: string;
  arabicText: string;
  reflection: string;
}

const VERIFIED_QURAN_VERSES: QuranVerse[] = [
  {
    surah: 'سورة نوح',
    ayahNumber: 'الآيات ١٠ – ١٢',
    arabicText:
      '﴿فَقُلْتُ اسْتَغْفِرُوا رَبَّكُمْ إِنَّهُ كَانَ غَفَّارًا ۝ يُرْسِلِ السَّمَاءَ عَلَيْكُم مِّدْرَارًا ۝ وَيُمْدِدْكُم بِأَمْوَالٍ وَبَنِينَ وَيَجْعَل لَّكُمْ جَنَّاتٍ وَيَجْعَل لَّكُمْ أَنْهَارًا﴾',
    reflection: 'وعدٌ إلهي كريم بالمغفرة والبركة والغيث والرزق لمن داوم على الاستغفار.',
  },
  {
    surah: 'سورة هود',
    ayahNumber: 'الآية ٣',
    arabicText:
      '﴿وَأَنِ اسْتَغْفِرُوا رَبَّكُمْ ثُمَّ تُوبُوا إِلَيْهِ يُمَتِّعْكُم مَّتَاعًا حَسَنًا إِلَىٰ أَجَلٍ مُّسَمًّى وَيُؤْتِ كُلَّ ذِي فَضْلٍ فَضْلَهُ﴾',
    reflection: 'الاستغفار والتوبة الصادقة سببٌ للمتاع الحسن والسكينة في الدنيا والآخرة.',
  },
  {
    surah: 'سورة الأنفال',
    ayahNumber: 'الآية ٣٣',
    arabicText:
      '﴿وَمَا كَانَ اللَّهُ لِيُعَذِّبَهُمْ وَأَنتَ فِيهِمْ ۚ وَمَا كَانَ اللَّهُ مُعَذِّبَهُمْ وَهُمْ يَسْتَغْفِرُونَ﴾',
    reflection: 'الاستغفار أمانٌ لأهل الأرض من البلاء والعقوبة.',
  },
  {
    surah: 'سورة آل عمران',
    ayahNumber: 'الآية ١٣٥',
    arabicText:
      '﴿وَالَّذِينَ إِذَا فَعَلُوا فَاحِشَةً أَوْ ظَلَمُوا أَنفُسَهُمْ ذَكَرُوا اللَّهَ فَاسْتَغْفِرُوا لِذُنُوبِهِمْ وَمَن يَغْفِرُ الذُّنُوبَ إِلَّا اللَّهُ﴾',
    reflection: 'باب التوبة والإنابة مفتوحٌ دائماً، ولا يغفر الذنوب إلا الله وحده.',
  },
];

export const VirtuesAndAboutSection: React.FC<{ onOpenAdmin: () => void }> = ({
  onOpenAdmin,
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Ignore clipboard errors
    }
  };

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(
    `شاركنا في حملة الاستغفار: «أستغفر الله العظيم وأتوب إليه»\n${window.location.origin}`
  )}`;

  return (
    <>
      {/* Virtues Section */}
      <section id="virtues" className="py-14 sm:py-16 border-b border-[#E4DFD3]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            <div className="lg:col-span-5">
              <p className="text-xs font-semibold text-[#065F46] mb-1.5">من كتاب الله العزيز</p>
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-[#1A2420] mb-4">
                فضل الاستغفار في القرآن الكريم
              </h2>
              <p className="text-sm sm:text-base text-[#53615B] leading-relaxed mb-6">
                أمر الله تعالى عباده بالاستغفار والتوبة في مواضع عديدة من كتابه الكريم، وبيّن ما يترتب عليه من المغفرة والرزق والطمأنينة.
              </p>

              <div className="rounded-2xl overflow-hidden border border-[#DED7C8] bg-[#EFEAE0] aspect-[4/3]">
                {!imgFailed ? (
                  <img
                    src="/src/assets/images/virtue_mushaf_still_life_1795525775959.jpg"
                    alt="مصحف شريف بجلد أخضر زمردي وزخارف ذهبية على حامل خشبي"
                    referrerPolicy="no-referrer"
                    onError={() => setImgFailed(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full islamic-lattice-bg flex items-center justify-center p-6 text-center">
                    <span className="font-display text-2xl text-[#064E3B]">
                      القرآن الكريم
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-7 space-y-4">
              {VERIFIED_QURAN_VERSES.map((v) => (
                <article
                  key={v.surah}
                  className="bg-white border border-[#DED7C8] rounded-2xl p-6"
                >
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#B48327] mb-3">
                    <span>{v.surah}</span>
                    <span aria-hidden="true">·</span>
                    <span>{v.ayahNumber}</span>
                  </div>
                  <p className="font-display text-xl sm:text-2xl leading-[1.9] text-[#1A2420] mb-3">
                    {v.arabicText}
                  </p>
                  <p className="text-sm text-[#53615B] leading-relaxed">{v.reflection}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* About Campaign & Share Section */}
      <section id="about" className="py-14 sm:py-16 bg-[#F4EFE4]/60">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-xs font-semibold text-[#065F46] mb-1.5">رسالتنا وهدفنا</p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-[#1A2420] mb-4">
            عن حملة الاستغفار
          </h2>
          <p className="text-base text-[#45544E] leading-relaxed mb-8">
            «حملة الاستغفار» مبادرة رقمية إسلامية تهدف إلى إحياء ذكر الاستغفار في الحياة اليومية عبر عداد شخصي دقيق وموثق في قاعدة البيانات السحابية، يتيح لكل مشارك متابعة ورده اليومي، والمشاركة في هذا العمل الجماعي المبارك مع الحفاظ التام على الخصوصية والشفافية.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#065F46] text-white text-sm font-semibold hover:bg-[#044734] transition-colors"
            >
              <Share2 className="w-4 h-4" />
              <span>شارك رابط الحملة عبر واتساب</span>
            </a>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white border border-[#D4CCC0] text-sm font-semibold text-[#1A2420] hover:border-[#B48327] transition-colors cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-[#065F46]" />
                  <span>تم نسخ الرابط بنجاح</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-[#B48327]" />
                  <span>نسخ رابط الموقع</span>
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* Quiet Footer */}
      <footer className="border-t border-[#E4DFD3] bg-[#FAF8F3] py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#6C7772]">
          <div className="flex items-center gap-2">
            <span className="font-display text-base font-bold text-[#064E3B]">حملة الاستغفار</span>
            <span aria-hidden="true">·</span>
            <span>أستغفر الله العظيم وأتوب إليه</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="#virtues" className="hover:text-[#065F46] transition-colors">
              فضل الاستغفار
            </a>
            <a href="#participants" className="hover:text-[#065F46] transition-colors">
              المشاركون
            </a>
            <button
              type="button"
              onClick={onOpenAdmin}
              className="hover:text-[#065F46] transition-colors cursor-pointer"
            >
              لوحة الإدارة
            </button>
          </div>
        </div>
      </footer>
    </>
  );
};
