export interface Point {
  x: number;
  y: number;
}

export interface ViewportDimensions {
  widthPixels: number;
  heightPixels: number;
}

const DEBUGGER_PROTOCOL_VERSION = "1.3";

export class TabController {
  private readonly debuggee: chrome.debugger.Debuggee;

  constructor(public readonly id: number) {
    this.debuggee = { tabId: id };
  }

  async move(point: Point): Promise<void> {
    await this.assertPointInViewport(point);

    await this.withDebugger(async () => {
      await this.sendMouseEvent({
        type: "mouseMoved",
        x: point.x,
        y: point.y
      });
    });
  }

  private async getViewportDimensions(): Promise<ViewportDimensions> {
    const metrics = await this.withDebugger(async () => {
      return await chrome.debugger.sendCommand(
        this.debuggee,
        "Page.getLayoutMetrics"
      ) as {
        cssVisualViewport: {
          clientWidth: number;
          clientHeight: number;
        };
      };
    });

    return {
      widthPixels: metrics.cssVisualViewport.clientWidth,
      heightPixels: metrics.cssVisualViewport.clientHeight
    };
  }

  async drag(start: Point, end: Point): Promise<void> {
    await this.assertPointInViewport(start);
    await this.assertPointInViewport(end);

    await this.withDebugger(async () => {
      await this.sendMouseEvent({
        type: "mouseMoved",
        x: start.x,
        y: start.y
      });

      await this.sendMouseEvent({
        type: "mousePressed",
        x: start.x,
        y: start.y,
        button: "left",
        buttons: 1,
        clickCount: 1
      });
      await this.sendMouseEvent({
        type: "mouseMoved",
        x: end.x,
        y: end.y
      });
      await this.sendMouseEvent({
        type: "mouseReleased",
        x: end.x,
        y: end.y,
        button: "left",
        clickCount: 1
      });
    });
  }
  async click(point: Point): Promise<void> {
    await this.assertPointInViewport(point);

    await this.withDebugger(async () => {
      await this.sendMouseEvent({
        type: "mouseMoved",
        x: point.x,
        y: point.y
      });
      await this.sendMouseEvent({
        type: "mousePressed",
        x: point.x,
        y: point.y,
        button: "left",
        buttons: 1,
        clickCount: 1
      });
      await this.sendMouseEvent({
        type: "mouseReleased",
        x: point.x,
        y: point.y,
        button: "left",
        clickCount: 1
      });
    });
  }

  private async withDebugger<T>(action: () => Promise<T>): Promise<T> {
    let debuggerAttached = false;
    let operationFailed = false;

    try {
      await chrome.debugger.attach(this.debuggee, DEBUGGER_PROTOCOL_VERSION);
      debuggerAttached = true;
      return await action();
    } catch (error) {
      operationFailed = true;
      throw error;
    } finally {
      if (debuggerAttached) {
        try {
          await chrome.debugger.detach(this.debuggee);
        } catch (error) {
          if (!operationFailed) {
            throw error;
          }
        }
      }
    }
  }

  private async sendMouseEvent(params: Record<string, unknown>): Promise<void> {
    await chrome.debugger.sendCommand(
      this.debuggee,
      "Input.dispatchMouseEvent",
      params
    );
  }

  private async assertPointInViewport(point: Point): Promise<void> {
    if (!await this.pointIsInViewport(point)) {
      throw new Error(`Point (${point.x}, ${point.y}) is outside the tab viewport.`);
    }
  }

  private async pointIsInViewport(point: Point): Promise<boolean> {
    const { widthPixels, heightPixels } = await this.getViewportDimensions();

    return (
      point.x >= 0 &&
      point.x < widthPixels &&
      point.y >= 0 &&
      point.y < heightPixels
    );
  }
}
