import { createContext, useContext, useEffect, useState } from "react";
import i18n from "@/i18n";

type Lang = "en" | "ar";

interface LanguageContextType {
    lang: Lang;
    setLang: (lang: Lang) => void;
    isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType>({
    lang: "en",
    setLang: () => { },
    isRTL: false,
});

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
    const [lang, setLangState] = useState<Lang>(
        () => (localStorage.getItem("app-lang") as Lang) || "en"
    );

    const isRTL = lang === "ar";

    const setLang = (newLang: Lang) => {
        setLangState(newLang);
        localStorage.setItem("app-lang", newLang);
        i18n.changeLanguage(newLang);
    };

    useEffect(() => {
        document.documentElement.dir = isRTL ? "rtl" : "ltr";
        document.documentElement.lang = lang;
        i18n.changeLanguage(lang);
    }, [lang, isRTL]);

    return (
        <LanguageContext.Provider value={{ lang, setLang, isRTL }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => useContext(LanguageContext);
