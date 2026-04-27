/**
 * useLanguage - Hook para gestión de idioma
 * Detecta idioma del sistema y permite cambio manual
 */

import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import esTranslations from '@/i18n/es.json';
import enTranslations from '@/i18n/en.json';

type Language = 'es' | 'en';

interface Translations {
  [key: string]: any;
}

const translations: Record<Language, Translations> = {
  es: esTranslations,
  en: enTranslations,
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

const STORAGE_KEY = 'epicenter-language';

// Detectar idioma del sistema
const detectSystemLanguage = (): Language => {
  const systemLang = navigator.language || (navigator as any).userLanguage || 'es';
  const langCode = systemLang.split('-')[0].toLowerCase();
  
  if (langCode === 'en') return 'en';
  return 'es'; // Español por defecto
};

// Obtener idioma guardado o detectar del sistema
const getInitialLanguage = (): Language => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'es' || saved === 'en') {
      return saved;
    }
  } catch (e) {
    // localStorage no disponible
  }
  return detectSystemLanguage();
};

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  // Guardar idioma cuando cambie
  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) {
      // localStorage no disponible
    }
  }, []);

  // Función de traducción
  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    const keys = key.split('.');
    let value: any = translations[language];
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        // Si no encuentra la traducción, buscar en español (idioma base)
        value = translations['es'];
        for (const k2 of keys) {
          if (value && typeof value === 'object' && k2 in value) {
            value = value[k2];
          } else {
            return key; // Devolver la key si no se encuentra
          }
        }
        break;
      }
    }
    
    if (typeof value !== 'string') {
      return key;
    }
    
    // Reemplazar parámetros {param}
    if (params) {
      return value.replace(/\{(\w+)\}/g, (_, paramKey) => {
        return params[paramKey]?.toString() || `{${paramKey}}`;
      });
    }
    
    return value;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

export default useLanguage;
