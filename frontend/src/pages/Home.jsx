import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  LogIn,
  BookOpen,
  ClipboardList,
  Users,
  BarChart3,
  TrendingUp,
  Palette,
  Smartphone,
  ArrowRight,
  ExternalLink,
  Calculator,
  ListChecks,
  Image,
  CheckCircle,
  Shield,
  Globe,
  Layers,
  FileText,
  PieChart,
  Settings,
  Zap,
  Lock,
  Monitor,
} from "lucide-react";
import { useSiteStatus } from "../contexts/SiteStatusContext.jsx";

const FEATURES = [
  { key: "quizzes", icon: ClipboardList },
  { key: "groups", icon: Users },
  { key: "attempts", icon: BarChart3 },
  { key: "stats", icon: TrendingUp },
  { key: "themes", icon: Palette },
  { key: "responsive", icon: Smartphone },
  { key: "math", icon: Calculator },
  { key: "questionTypes", icon: ListChecks },
  { key: "images", icon: Image },
];

const BENEFITS = [
  { key: "easy", icon: Zap },
  { key: "secure", icon: Lock },
  { key: "accessible", icon: Monitor },
];

const PROCESS_STEPS = [
  { 
    number: "01", 
    key: "register",
    icon: FileText,
  },
  { 
    number: "02", 
    key: "create",
    icon: Settings,
  },
  { 
    number: "03", 
    key: "share",
    icon: PieChart,
  },
];

const BANNER_STYLE_CLASSES = {
  warning:
    "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/15 dark:text-amber-200",
  info: "border-blue-500/30 bg-blue-500/10 text-blue-800 dark:border-blue-400/30 dark:bg-blue-500/15 dark:text-blue-200",
  success:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-200",
  neutral:
    "border-[var(--border)] bg-[var(--surface)] text-[var(--text)]",
};

export default function Home() {
  const { t, i18n } = useTranslation();
  const siteStatus = useSiteStatus() ?? {
    maintenance_mode: false,
    registration_enabled: true,
    home_banner_text: {},
    home_banner_style: "warning",
  };

  const getBannerText = () => {
    const bannerTexts = siteStatus.home_banner_text;
    if (!bannerTexts || typeof bannerTexts !== "object") return "";
    
    const currentLang = i18n.language;
    if (bannerTexts[currentLang]?.trim()) return bannerTexts[currentLang];
    const fallbackOrder = ["ru", "en", "lt"];
    for (const lang of fallbackOrder) {
      if (bannerTexts[lang]?.trim()) return bannerTexts[lang];
    }
    return "";
  };

  const bannerStyle = BANNER_STYLE_CLASSES[siteStatus.home_banner_style] || BANNER_STYLE_CLASSES.warning;
  const bannerText = getBannerText();
  const showBanner = !!bannerText;

  const urlRegex = /(https?:\/\/[^\s<>"]+)/gi;
  const bannerParts = bannerText
    ? bannerText.split(urlRegex).map((part) => {
        const isUrl = /^https?:\/\//i.test(part);
        return { type: isUrl ? "link" : "text", value: part, href: isUrl ? part : undefined };
      })
    : [];

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 relative">
      {/* Global Grid Pattern */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
      
      {showBanner && (
        <div
          className={`relative border-b px-4 py-3 text-center text-sm font-medium sm:px-6 ${bannerStyle}`}
          role="alert"
        >
          {bannerParts.map((part, i) =>
            part.type === "link" ? (
              <a
                key={i}
                href={part.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-bold underline decoration-2 underline-offset-2 hover:no-underline"
              >
                {part.value}
                <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
              </a>
            ) : (
              <span key={i}>{part.value}</span>
            )
          )}
        </div>
      )}

      {/* Hero Section - Minimalist Design */}
      <section className="relative overflow-hidden border-b border-neutral-200 dark:border-neutral-800">
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32 lg:py-40">
          <div className="max-w-4xl">
            {/* Small Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 mb-8">
              <div className="w-1.5 h-1.5 rounded-full bg-neutral-900 dark:bg-neutral-100" />
              <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                {t("home.firstRequestWarning")}
              </span>
            </div>

            {/* Main Heading */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 mb-6 leading-[1.1]">
              {t("common.appName")}
              <span className="block text-neutral-500 dark:text-neutral-400 mt-2">
                {t("home.subtitle")}
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-lg sm:text-xl text-neutral-600 dark:text-neutral-400 mb-10 max-w-2xl leading-relaxed">
              {t("home.tagline")}
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                to="/auth"
                className="group inline-flex items-center justify-center gap-2 px-8 py-4 bg-neutral-900 dark:bg-neutral-50 hover:bg-neutral-800 dark:hover:bg-neutral-200 text-white dark:text-neutral-900 font-semibold rounded-lg transition-all duration-200"
              >
                <LogIn className="w-5 h-5" />
                {t("home.login")}
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                to="/blog"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-900 dark:text-neutral-50 font-semibold rounded-lg border border-neutral-200 dark:border-neutral-800 transition-all duration-200"
              >
                <BookOpen className="w-5 h-5" />
                {t("home.devBlog")}
              </Link>
            </div>
          </div>

          {/* Decorative Element */}
          <div className="absolute top-1/2 right-0 -translate-y-1/2 w-96 h-96 bg-neutral-100 dark:bg-neutral-900 rounded-full blur-3xl opacity-30 pointer-events-none" />
        </div>
      </section>

      {/* Benefits Section - Clean Cards */}
      <section className="relative py-20 sm:py-24 border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            {BENEFITS.map(({ key, icon: Icon }) => (
              <div key={key} className="group">
                <div className="bg-white/80 dark:bg-neutral-950/80 backdrop-blur-sm border border-neutral-200 dark:border-neutral-800 rounded-xl p-8 h-full hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors duration-200">
                  <div className="w-12 h-12 rounded-lg bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center mb-6">
                    <Icon className="w-6 h-6 text-neutral-900 dark:text-neutral-100" />
                  </div>
                  <h3 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50 mb-3">
                    {t(`home.benefits.${key}.title`)}
                  </h3>
                  <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed">
                    {t(`home.benefits.${key}.desc`)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative py-20 sm:py-24 border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-neutral-900 dark:text-neutral-50 mb-4">
              {t("home.howToStartTitle")}
            </h2>
            <p className="text-lg text-neutral-600 dark:text-neutral-400">
              {t("home.howToStartDesc")}
            </p>
          </div>

          <div className="space-y-12">
            {PROCESS_STEPS.map(({ number, key, icon: Icon }, index) => (
              <div key={key} className="flex gap-8 items-start">
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 rounded-full bg-neutral-100/80 dark:bg-neutral-900/80 backdrop-blur-sm border-2 border-neutral-200 dark:border-neutral-800 flex items-center justify-center">
                    <span className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">
                      {number}
                    </span>
                  </div>
                  {index < PROCESS_STEPS.length - 1 && (
                    <div className="w-0.5 h-24 bg-neutral-200 dark:bg-neutral-800 mx-auto mt-4" />
                  )}
                </div>
                <div className="flex-1 pt-3">
                  <div className="flex items-start gap-4 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-neutral-100/80 dark:bg-neutral-900/80 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                      <Icon className="w-5 h-5 text-neutral-900 dark:text-neutral-100" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50 mb-2">
                        {t(`home.steps.${key}.title`)}
                      </h3>
                      <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed">
                        {t(`home.steps.${key}.desc`)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative py-20 sm:py-24 border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-neutral-900 dark:text-neutral-50 mb-4">
              {t("home.featuresTitle")}
            </h2>
            <p className="text-lg text-neutral-600 dark:text-neutral-400">
              {t("home.featuresDesc")}
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {FEATURES.map(({ key, icon: Icon }, index) => (
              <div
                key={key}
                className="group relative"
              >
                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-neutral-200 dark:bg-neutral-800 group-hover:bg-neutral-900 dark:group-hover:bg-neutral-100 transition-colors duration-300" />
                <div className="pl-6 space-y-3">
                  <div className="inline-flex p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white/60 dark:bg-neutral-950/60 backdrop-blur-sm group-hover:border-neutral-900 dark:group-hover:border-neutral-100 transition-all duration-300">
                    <Icon className="w-5 h-5 text-neutral-900 dark:text-neutral-100" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <h3 className="font-bold text-base text-neutral-900 dark:text-neutral-50">
                      {t(`home.features.${key}.title`)}
                    </h3>
                    <span className="text-xs font-mono text-neutral-400 dark:text-neutral-600">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                    {t(`home.features.${key}.desc`)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative py-20 sm:py-24 border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-neutral-50/80 dark:bg-neutral-900/80 backdrop-blur-sm border border-neutral-200 dark:border-neutral-800 rounded-2xl p-8 sm:p-12">
            <div className="flex items-start gap-3 mb-6">
              <div className="w-8 h-8 rounded-lg bg-neutral-900 dark:bg-neutral-100 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-5 h-5 text-neutral-50 dark:text-neutral-900" />
              </div>
              <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">
                {t("home.aboutTitle")}
              </h2>
            </div>
            <div className="space-y-4 text-neutral-600 dark:text-neutral-400 leading-relaxed">
              <p className="text-lg">
                {t("home.about1")}
              </p>
              <p>
                {t("home.about2")}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="relative py-20 sm:py-24 border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-neutral-900 dark:text-neutral-50 mb-6 leading-tight">
            {t("home.howToStartTitle")}
          </h2>
          <p className="text-lg text-neutral-600 dark:text-neutral-400 mb-10 max-w-2xl mx-auto">
            {t("home.howToStart")}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/auth"
                className="group inline-flex items-center gap-2 px-8 py-4 bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-neutral-50 dark:hover:bg-neutral-200 dark:text-neutral-900 font-semibold rounded-lg transition-all duration-200"
            >
              <LogIn className="w-5 h-5" />
              {t("home.login")}
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
