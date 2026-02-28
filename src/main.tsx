import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
<<<<<<< HEAD
import "./i18n";
import { LanguageProvider } from "./contexts/LanguageContext";

createRoot(document.getElementById("root")!).render(
    <LanguageProvider>
        <App />
    </LanguageProvider>
);
=======

createRoot(document.getElementById("root")!).render(<App />);
>>>>>>> 5b56e227004fb842bfd26ac33621142a3f1e8a88
