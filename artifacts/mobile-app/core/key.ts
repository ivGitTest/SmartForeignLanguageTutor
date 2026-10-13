/** Never persist a credential insecurely in the browser preview. */
const unavailable = () => { throw new Error("API keys are supported only in the Android app, using protected storage. Browser preview is for local screens and learning."); };
export const keyStorage = {
  async has() { return false; },
  async readForRequest(): Promise<string> { return unavailable(); },
  async save(_value: string, _signal?: AbortSignal) { unavailable(); },
  async remove() { unavailable(); },
};
