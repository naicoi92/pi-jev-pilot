import { PiFixture, type RecordData } from "./pi-cli.ts";

/** Main-consumer regression fixtures use explicit JSON options, never option env translation. */
export class MainConfigFixture extends PiFixture {
  environment: Record<string, string> = {};

  override async start(config: RecordData = {}, thinkingOverride?: string): Promise<this> {
    const { classifier, ...options } = config;
    this.jevConfig = {
      strategyEnabled: this.useGuidanceDefaults,
      qualityEnabled: this.useGuidanceDefaults,
      designEnabled: this.useDesignDefaults,
      ...this.jevConfig,
      ...options,
    };
    this.classifierConfig = { ...this.classifierConfig, ...(classifier as RecordData | undefined) };
    return super.start(this.environment, thinkingOverride);
  }
}
