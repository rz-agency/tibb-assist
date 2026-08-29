import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './en.json'
import ur from './ur.json'

const LANG_KEY = 'tibb-assist-lang'

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ur: { translation: ur },
  },
  lng: localStorage.getItem(LANG_KEY) || 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
})

export const setLanguage = (lang) => {
  i18n.changeLanguage(lang)
  localStorage.setItem(LANG_KEY, lang)
  document.documentElement.dir = lang === 'ur' ? 'rtl' : 'ltr'
  document.documentElement.lang = lang
}

setLanguage(i18n.language)

export default i18n
