import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ko from './locales/ko.json';
import en from './locales/en.json';

// Load language from localStorage or default to 'ko'
const getStoredLanguage = (): string => {
  try {
    const stored = localStorage.getItem('move37_language');
    return stored === 'en' || stored === 'ko' ? stored : 'ko';
  } catch {
    return 'ko';
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources: {
      ko: { translation: ko },
      en: { translation: en },
    },
    lng: getStoredLanguage(),
    fallbackLng: 'ko',
    interpolation: {
      escapeValue: false, // React already escapes values
    },
  });

// Listen for language changes
window.addEventListener('storage', (e) => {
  if (e.key === 'move37_language' && e.newValue) {
    i18n.changeLanguage(e.newValue);
  }
});

export default i18n;
