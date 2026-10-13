import { repository } from "./app-store";
import { createMaterialActions } from "./material-actions";
import { chat, transcribe } from "./openrouter";
export const { generateA, generateB, retryTranslation, translateExpression } = createMaterialActions(repository, { chat, transcribe });
