import { useLanguageStore } from "./languageStore";
import { zhCN, type TranslationKey } from "./locales/zh-CN";
import { en } from "./locales/en";
import { ko } from "./locales/2026-11-08-ko";
import { tr } from "./locales/tr";
import type { Language } from "./languageStore";

const dictionaries: Record<Language, Record<TranslationKey, string>> = {
  "zh-CN": zhCN,
  en,
  tr,
  ko: Object.fromEntries(Object.entries(ko).map(([key, label]) => [key, label === en[key as TranslationKey] ? zhCN[key as TranslationKey] : label])) as Record<TranslationKey, string>,
};

export function useTranslation() {
  const language = useLanguageStore((s) => s.language);

  const t = (key: TranslationKey, vars?: Record<string, string | number>): string => {
    let value = dictionaries[language][key] || dictionaries["zh-CN"][key] || key;
    if (vars) {
      value = value.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
    }
    return value;
  };

  return { t, language };
}