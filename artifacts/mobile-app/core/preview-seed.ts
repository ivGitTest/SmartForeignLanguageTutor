import type { Repository } from "./repository";

// Platform implementations provide development-preview data or a no-op.
export async function seedPreviewMaterials(_repository: Repository): Promise<void> {}
