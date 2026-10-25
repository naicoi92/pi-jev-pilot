import type { ExtensionUIContext } from "@earendil-works/pi-coding-agent";
import type { LiveOutcome, LiveStatusLine } from "./live-status.ts";

const KEY = "jev-pilot";

/** UI ownership is separate from setter ownership: our own thinking write emits
 * a selection event, but must not invalidate the completed outcome. The footer
 * keeps the elapsed-time record; the live line carries what the user sees. */
export class EffortVisibility {
  private owner = 0;
  private pending: { started: number; owner: number; choice: number } | undefined;
  private ui: ExtensionUIContext | undefined;

  constructor(private readonly live: LiveStatusLine) {}

  start(ui: ExtensionUIContext): number {
    this.clear();
    const owner = ++this.owner;
    this.ui = ui;
    this.pending = { started: Date.now(), owner, choice: this.live.choose() };
    return owner;
  }

  finish(owner: number, outcome: string, settled: LiveOutcome): boolean {
    if (owner !== this.owner || !this.pending || !this.ui) return false;
    const { started, choice } = this.pending;
    this.pending = undefined;
    this.ui.setStatus(KEY, `jev · ${outcome} · ${Date.now() - started}ms`);
    this.live.settle(choice, settled);
    return true;
  }

  clear(): void {
    this.owner++;
    this.live.stopChoosing();
    this.ui?.setStatus(KEY, undefined);
    this.pending = undefined;
    this.ui = undefined;
  }
}
