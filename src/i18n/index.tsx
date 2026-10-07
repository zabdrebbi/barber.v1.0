import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { ar, type Translations } from './locales/ar';
import { en, type DeepPartial } from './locales/en';

export type Locale = 'ar' | 'en';

const dictionaries: Record<Locale, unknown> = { ar, en };

interface I18nValue {
  locale: Locale;
  dir: 'rtl' | 'ltr';
  setLocale: (l: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

function lookup(dict: unknown, key: string): string | undefined {
  const parts = key.split('.');
  let cur: unknown = dict;
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return undefined;
    }
  }
  return typeof cur === 'string' ? cur : undefined;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const locale: Locale = 'ar';

  const t = useCallback((key: string, params?: Record<string, string | number>) => {
    let text = lookup(dictionaries[locale], key) ?? lookup(ar as unknown, key) ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replaceAll(`{${k}}`, String(v));
      }
    }
    return text;
  }, [locale]);

  const setLocale = useCallback((_l: Locale) => {
    // لغات إضافية لاحقاً — الواجهة عربية فقط حالياً
  }, []);

  const value = useMemo<I18nValue>(() => ({ locale, dir: 'rtl', setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

export function useT() {
  return useI18n().t;
}

export type { Translations, DeepPartial };
