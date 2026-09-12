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
    let operationError: Error | undefined;

    try {
      await chrome.debugger.attach(this.debuggee, DEBUGGER_PROTOCOL_VERSION);
      debuggerAttached = true;
      await action();
    } catch (error) {
      operationError = new Error(
        `Could not control tab ${this.id}: ${getErrorMessage(error)}`,
        { cause: error }
      );
      throw operationError;
    } finally {
      if (debuggerAttached) {
        try {
          await chrome.debugger.detach(this.debuggee);
        } catch (error) {
          if (!operationError) {
            throw new Error(
              `Could not detach debugger from tab ${this.id}: ${getErrorMessage(error)}`,
              { cause: error }
            );
          }
        }
      }
    }
  }

  private async sendMouseEvent(params: Record<string, unknown>): Promise<void> {
    try {
      await chrome.debugger.sendCommand(
        this.debuggee,
        "Input.dispatchMouseEvent",
        params
      );
    } catch (error) {
      throw new Error(
        `Could not send mouse event to tab ${this.id}: ${getErrorMessage(error)}`,
        { cause: error }
      );
    }
  }

}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
