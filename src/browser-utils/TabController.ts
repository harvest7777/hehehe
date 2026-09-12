export interface Point {
  x: number;
  y: number;
}

const DEBUGGER_PROTOCOL_VERSION = "1.3";

export class TabController {
  private readonly debuggee: chrome.debugger.Debuggee;
  private lastPointerPosition?: Point;

  constructor(public readonly id: number) {
    this.debuggee = { tabId: id };
  }

  async move(point: Point): Promise<void> {
    await this.withDebugger(async () => {
      await this.sendMouseEvent({
        type: "mouseMoved",
        x: point.x,
        y: point.y
      });
    });

    this.lastPointerPosition = point;
  }

  async click(point: Point): Promise<void> {
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

    this.lastPointerPosition = point;
  }

  private async withDebugger(action: () => Promise<void>): Promise<void> {
    let debuggerAttached = false;
    let operationFailed = false;

    try {
      await chrome.debugger.attach(this.debuggee, DEBUGGER_PROTOCOL_VERSION);
      debuggerAttached = true;
      await action();
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
}
