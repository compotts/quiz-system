import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { STORAGE_KEY } from "../i18n.js";

const LANGS = [
  { code: "lt", label: "LT" },
  { code: "ru", label: "RU" },
  { code: "en", label: "EN" },
];

export function useLanguage() {
  const { i18n: i18nInstance } = useTranslation();
  const lang = i18nInstance.language || "ru";

  const setLang = useCallback(
    (code) => {
      if (!LANGS.some((l) => l.code === code)) return;
      i18nInstance.changeLanguage(code);
      try {
        localStorage.setItem(STORAGE_KEY, code);
        if (typeof document !== "undefined") document.documentElement.lang = code;
      } catch (e) {}
    },
    [i18nInstance]
  );

  return { lang, setLang, langs: LANGS };
}
