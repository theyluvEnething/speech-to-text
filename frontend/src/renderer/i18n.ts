import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "@/locales/en.json";
import de from "@/locales/de.json";
import it from "@/locales/it.json";
import es from "@/locales/es.json";
import ja from "@/locales/ja.json";

const resources = { en: { translation: en }, de: { translation: de }, it: { translation: it }, es: { translation: es }, ja: { translation: ja } };

i18n.use(initReactI18next).init({
  resources,
  lng: "en",
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
    prefix: "{",
    suffix: "}"
  },
});

export default i18n;
