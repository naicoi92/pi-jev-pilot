import type { ExtensionUIContext } from "@earendil-works/pi-coding-agent";

const KEY = "jev-pilot";

/** UI ownership is separate from setter ownership: our own thinking write emits
 * a selection event, but must not invalidate the completed outcome. */
export class EffortVisibility {
  private owner = 0;
  private pending: { ui: ExtensionUIContext; started: number; owner: number } | undefined;
  private ui: ExtensionUIContext | undefined;

  start(ui: ExtensionUIContext): number {
    this.clear();
    const owner = ++this.owner;
    this.ui = ui;
    this.pending = { ui, started: Date.now(), owner };
    ui.setWidget(KEY, ["Jev · choosing effort…"]);
    return owner;
  }

  finish(owner: number, outcome: string): boolean {
    if (owner !== this.owner || !this.pending) return false;
    const { ui, started } = this.pending;
    this.pending = undefined;
    ui.setWidget(KEY, undefined);
    ui.setStatus(KEY, `jev · ${outcome} · ${Date.now() - started}ms`);
    return true;
  }

  clear(): void {
    this.owner++;
    this.ui?.setWidget(KEY, undefined);
    this.ui?.setStatus(KEY, undefined);
    this.pending = undefined;
    this.ui = undefined;
  }
}
