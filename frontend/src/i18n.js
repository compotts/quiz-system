import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ru from "./locales/ru.json";
import en from "./locales/en.json";
import lt from "./locales/lt.json";

export const STORAGE_KEY = "quizz-lang";

function getInitialLang() {
  if (typeof window === "undefined") return "ru";
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved && ["ru", "lt", "en"].includes(saved) ? saved : "ru";
}

i18n.use(initReactI18next).init({
  resources: {
    ru: { translation: ru },
    en: { translation: en },
    lt: { translation: lt },
  },
  lng: getInitialLang(),
  fallbackLng: "ru",
  supportedLngs: ["ru", "lt", "en"],
  interpolation: { escapeValue: false },
});

export default i18n;
