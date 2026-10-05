import { createRoot } from "react-dom/client";
import App from "./App";
import { tr } from "./localization";
import "./styles.css";
import "./pages/Home/styles.css";
import "./tools/PdfBooklet/styles.css";
import "./tools/CardPrinter/styles.css";
import "./tools/BoardGenerator/styles.css";
import "./tools/pdf-preview.css";
import "./tools/pdf-preview.tsx";

window.tr = tr;
const container = document.getElementById("app");
if (!container) throw new Error("App container is missing");
createRoot(container).render(<App />);
