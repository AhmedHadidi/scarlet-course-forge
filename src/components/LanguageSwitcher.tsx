import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";

const LanguageSwitcher = () => {
    const { lang, setLang } = useLanguage();

    return (
        <div className="flex items-center border border-border rounded-md overflow-hidden text-sm font-medium">
            <button
                onClick={() => setLang("en")}
                className={`px-2.5 py-1 transition-colors ${lang === "en"
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted text-muted-foreground"
                    }`}
                aria-label="Switch to English"
            >
                EN
            </button>
            <div className="w-px h-5 bg-border" />
            <button
                onClick={() => setLang("ar")}
                className={`px-2.5 py-1 transition-colors font-[Tajawal,sans-serif] ${lang === "ar"
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted text-muted-foreground"
                    }`}
                aria-label="Switch to Arabic"
            >
                AR
            </button>
        </div>
    );
};

export default LanguageSwitcher;
