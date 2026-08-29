import { useTranslation } from 'react-i18next'
import { setLanguage } from '../i18n/config'

function LanguageSwitcher() {
  const { i18n } = useTranslation()
  const currentLang = i18n.language

  const toggle = () => {
    setLanguage(currentLang === 'ur' ? 'en' : 'ur')
  }

  return (
    <button
      className="button-secondary"
      onClick={toggle}
      aria-label={currentLang === 'ur' ? 'Switch to English' : 'Switch to Urdu'}
    >
      {currentLang === 'ur' ? 'EN' : 'اردو'}
    </button>
  )
}

export default LanguageSwitcher
