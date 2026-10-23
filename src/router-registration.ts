import type {
  ExtensionAPI,
  ExtensionContext,
  ExtensionVirtualModel,
} from "@earendil-works/pi-coding-agent";

/** Pi 1.4 retains definition.input by reference in the public catalog, including refresh. */
export class RouterRegistration {
  private input: ("text" | "image")[] | undefined;

  constructor(private readonly pi: ExtensionAPI) {}

  register<State>(ctx: ExtensionContext, definition: ExtensionVirtualModel<State>): void {
    const current = ctx.modelRegistry.find("jev", "auto");
    if (current) {
      if (this.input && current.input === this.input) return;
      throw new Error(
        "Cannot register jev/auto: another extension owns this model. Resolve the model ID collision, then reload Jev Pilot.",
      );
    }
    const input: ("text" | "image")[] = ["text", "image"];
    this.pi.registerVirtualModel<State>({ ...definition, input });
    this.input = input;
  }

  release(ctx: ExtensionContext): void {
    const current = ctx.modelRegistry.find("jev", "auto");
    if (this.input && current?.input === this.input) this.pi.unregisterVirtualModel("jev", "auto");
    this.input = undefined;
  }
}
