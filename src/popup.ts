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

const tryClickingTestButton = document.querySelector<HTMLButtonElement>("#try-clicking-test-button");
const tryDebuggerClickButton = document.querySelector<HTMLButtonElement>("#try-debugger-click");
const takeScreenshotButton = document.querySelector<HTMLButtonElement>("#take-screenshot");
const statusMessage = document.querySelector<HTMLElement>("#status");

if (!tryClickingTestButton || !tryDebuggerClickButton || !takeScreenshotButton || !statusMessage) {
  throw new Error("Popup controls are missing.");
}

tryClickingTestButton.addEventListener("click", async () => {
  tryClickingTestButton.disabled = true;
  statusMessage.textContent = "Looking for the test button...";

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

    statusMessage.textContent = "Clicked the test button.";
  } catch (error) {
    statusMessage.textContent = getErrorMessage(error);
  } finally {
    tryClickingTestButton.disabled = false;
  }
});

takeScreenshotButton.addEventListener("click", async () => {
  const [activeTab] = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true
  });

  if (!activeTab.id) {
    throw new Error("No active tab was found.");
  }

  const debuggee = { tabId: activeTab.id };
  await chrome.debugger.attach(debuggee, "1.3");
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
  await chrome.debugger.detach(debuggee);
});

tryDebuggerClickButton.addEventListener("click", async () => {
  tryDebuggerClickButton.disabled = true;
  statusMessage.textContent = "Attaching debugger...";

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

    statusMessage.textContent = "Sending debugger click...";

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

    statusMessage.textContent = "Sent debugger click.";
  } catch (error) {
    statusMessage.textContent = getErrorMessage(error);
  } finally {
    if (debuggerAttached && activeTabId) {
      try {
        await chrome.debugger.detach({ tabId: activeTabId });
      } catch (error) {
        statusMessage.textContent = `Debugger cleanup failed: ${getErrorMessage(error)}`;
      }
    }
    tryDebuggerClickButton.disabled = false;
  }
});

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
