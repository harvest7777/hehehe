import { createRoot } from "react-dom/client";
import { TabController } from "../browser-utils/TabController";

async function clickActiveTab(): Promise<void> {
  try {
    const [activeTab] = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true
    });

    if (activeTab?.id === undefined) {
      throw new Error("No active tab was found.");
    }

    await new TabController(activeTab.id).click({ x: 100, y: 100 });
  } catch (error) {
    console.error(error);
  }
}

function App() {
  return <button onClick={() => void clickActiveTab()}>Click at 100, 100</button>;
}

createRoot(document.getElementById("root")!).render(<App />);
