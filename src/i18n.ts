let i18nInstance: typeof import("i18next").default | undefined = undefined;

export async function getI18nInstance() {
  if (typeof window === "undefined") {
    // Не инициализируем i18next на сервере
    return undefined;
  }
  if (!i18nInstance) {
    const i18n = (await import("i18next")).default;
    const Backend = (await import("i18next-http-backend")).default;
    const LanguageDetector = (await import("i18next-browser-languagedetector")).default;
    const { initReactI18next } = await import("react-i18next");

    if (!i18n.isInitialized) {
      await i18n
        .use(Backend)
        .use(LanguageDetector)
        .use(initReactI18next)
        .init({
          fallbackLng: "en",
          supportedLngs: ["ru", "en", "fi", "lt", "lv", "pl", "et"],
          ns: ["common"],            // добавлен default namespace
          defaultNS: "common",
          debug: false,
          interpolation: { escapeValue: false },
          backend: {
            loadPath: "/locales/{{lng}}/{{ns}}.json",
          },
          detection: {
            order: ["cookie", "localStorage", "navigator"],
            caches: ["cookie", "localStorage"],
          },
        });
    }
    i18nInstance = i18n;
  }
  return i18nInstance;
}
