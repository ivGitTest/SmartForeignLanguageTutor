import type { Repository } from "./repository";

// Never ship browser-preview fixture data in a native app bundle.
export async function seedPreviewMaterials(_repository: Repository): Promise<void> {}
