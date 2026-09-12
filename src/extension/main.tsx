import { useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

interface ClickEventResult {
  clicked: boolean;
  reason: string;
}

interface ScreenshotArtifact {
  data: string;
}

interface DocumentResult {
  root: {
    nodeId: number;
  };
}

interface ButtonResult {
  nodeId: number;
}

interface BoxModelResult {
  model: {
    border: number[];
  };
}

function App() {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function clickTestButton() {
    setBusy(true);
    setStatus("Looking for the test button...");

    try {
      const [activeTab] = await chrome.tabs.query({
        active: true,
        lastFocusedWindow: true
      });

      if (!activeTab.id) {
        throw new Error("No active tab was found.");
      }

      const [clickResult] = await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: clickEventTestButton
      });
      const result = clickResult.result as ClickEventResult;

      if (!result.clicked) {
        throw new Error(result.reason);
      }

      setStatus("Clicked the test button.");
    } catch (error) {
      setStatus(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function clickWithDebugger() {
    setBusy(true);
    setStatus("Attaching debugger...");

    let debuggerAttached = false;
    let activeTabId: number | undefined;

    try {
      const [activeTab] = await chrome.tabs.query({
        active: true,
        lastFocusedWindow: true
      });

      if (!activeTab.id) {
        throw new Error("No active tab was found.");
      }

      activeTabId = activeTab.id;
      const debuggee = { tabId: activeTabId };
      await chrome.debugger.attach(debuggee, "1.3");
      debuggerAttached = true;

      await chrome.debugger.sendCommand(debuggee, "DOM.enable");
      const documentResult = await chrome.debugger.sendCommand(debuggee, "DOM.getDocument", {
        depth: -1,
        pierce: true
      }) as DocumentResult;
      const buttonResult = await chrome.debugger.sendCommand(debuggee, "DOM.querySelector", {
        nodeId: documentResult.root.nodeId,
        selector: "#test-button"
      }) as ButtonResult;

      if (!buttonResult.nodeId) {
        throw new Error("Could not find the test button.");
      }

      const boxModelResult = await chrome.debugger.sendCommand(debuggee, "DOM.getBoxModel", {
        nodeId: buttonResult.nodeId
      }) as BoxModelResult;
      const buttonCoordinates = getCenterPoint(boxModelResult.model.border);

      setStatus("Sending debugger click...");

      await chrome.debugger.sendCommand(debuggee, "Input.dispatchMouseEvent", {
        type: "mouseMoved",
        x: buttonCoordinates.x,
        y: buttonCoordinates.y
      });
      await chrome.debugger.sendCommand(debuggee, "Input.dispatchMouseEvent", {
        type: "mousePressed",
        x: buttonCoordinates.x,
        y: buttonCoordinates.y,
        button: "left",
        buttons: 1,
        clickCount: 1
      });
      await chrome.debugger.sendCommand(debuggee, "Input.dispatchMouseEvent", {
        type: "mouseReleased",
        x: buttonCoordinates.x,
        y: buttonCoordinates.y,
        button: "left",
        clickCount: 1
      });

      setStatus("Sent debugger click.");
    } catch (error) {
      setStatus(getErrorMessage(error));
    } finally {
      if (debuggerAttached && activeTabId) {
        try {
          await chrome.debugger.detach({ tabId: activeTabId });
        } catch (error) {
          setStatus(`Debugger cleanup failed: ${getErrorMessage(error)}`);
        }
      }
      setBusy(false);
    }
  }

  async function takeScreenshot() {
    setBusy(true);
    setStatus("Taking screenshot...");

    let debuggerAttached = false;
    let activeTabId: number | undefined;

    try {
      const [activeTab] = await chrome.tabs.query({
        active: true,
        lastFocusedWindow: true
      });

      if (!activeTab.id) {
        throw new Error("No active tab was found.");
      }

      activeTabId = activeTab.id;
      const debuggee = { tabId: activeTab.id };
      await chrome.debugger.attach(debuggee, "1.3");
      debuggerAttached = true;
      const screenshotArtifact = await chrome.debugger.sendCommand(
        debuggee,
        "Page.captureScreenshot"
      ) as ScreenshotArtifact;
      const screenshotDataUrl = `data:image/png;base64,${screenshotArtifact.data}`;
      const analysisResponse = await fetch("http://localhost:3000/analyze-screenshot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          imageDataUrl: screenshotDataUrl,
          prompt: "Identify the center coordinates of the button labeled Click me. Return only JSON with x and y coordinates relative to the image."
        })
      });
      const analysisResult = await analysisResponse.json();
      console.log(analysisResult);
      setStatus("Screenshot analyzed.");
    } catch (error) {
      setStatus(getErrorMessage(error));
    } finally {
      if (debuggerAttached && activeTabId) {
        await chrome.debugger.detach({ tabId: activeTabId });
      }
      setBusy(false);
    }
  }

  return (
    <main>
      <button type="button" disabled={busy} onClick={clickTestButton}>
        Try clicking test button
      </button>
      <button type="button" disabled={busy} onClick={clickWithDebugger}>
        Try debugger click
      </button>
      <button type="button" disabled={busy} onClick={takeScreenshot}>
        Take screenshot
      </button>
      <p role="status">{status}</p>
    </main>
  );
}

function clickEventTestButton(): ClickEventResult {
  const testButton = document.querySelector<HTMLButtonElement>("#test-button");

  if (!testButton) {
    return {
      clicked: false,
      reason: "Could not find the test button."
    };
  }

  testButton.click();

  return {
    clicked: true,
    reason: "Clicked the test button."
  };
}

function getCenterPoint(quad: number[]): { x: number; y: number } {
  const points: Array<{ x: number; y: number }> = [];

  for (let index = 0; index < quad.length; index += 2) {
    points.push({
      x: quad[index],
      y: quad[index + 1]
    });
  }

  return points.reduce(
    (center, point) => ({
      x: center.x + point.x / points.length,
      y: center.y + point.y / points.length
    }),
    { x: 0, y: 0 }
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

type ExtensionWindow = Window & {
  __browserExtensionRoot?: ReturnType<typeof createRoot>;
};

const extensionWindow = window as ExtensionWindow;
const root = extensionWindow.__browserExtensionRoot ?? createRoot(document.getElementById("root")!);
extensionWindow.__browserExtensionRoot = root;
root.render(<App />);
