/*
 * AI settings form is temporarily disabled: MVP users choose their models, but
 * do not edit prompts or generation parameters.
 *
 * Previous form implementation:
 *
 * import React, { useState } from "react";
 * import { Body, Button, Card, Field, Heading, Notice, Screen, useTask } from "@/components/ui";
 * import { Disclosure } from "@/components/disclosure";
 * import { useApp } from "@/core/app-store";
 * import { settingsSchema, type Parameters } from "@/core/model";
 * import { useUnsavedChanges } from "@/core/unsaved";
 *
 * type ParameterDraft = { temperature: string; top_p: string; max_tokens: string; seed: string };
 * const promptContainerStyle = { width: "100%", minWidth: 0 } as const;
 * const promptInputStyle = { width: "100%", minWidth: 0, maxWidth: "100%", fontSize: 15 } as const;
 * const draft = (p: Parameters): ParameterDraft => ({ temperature: String(p.temperature), top_p: String(p.top_p), max_tokens: String(p.max_tokens), seed: p.seed === undefined ? "" : String(p.seed) });
 * function parse(p: ParameterDraft): Parameters {
 *   for (const key of ["temperature", "top_p", "max_tokens"] as const) if (!p[key].trim() || !Number.isFinite(Number(p[key]))) throw new Error(`Enter a numeric ${key}.`);
 *   if (p.seed.trim() && !Number.isFinite(Number(p.seed))) throw new Error("Seed must be a whole number.");
 *   return { temperature: Number(p.temperature), top_p: Number(p.top_p), max_tokens: Number(p.max_tokens), ...(p.seed.trim() ? { seed: Number(p.seed) } : {}) };
 * }
 * function ParametersForm({ value, change }: { value: ParameterDraft; change: (p: ParameterDraft) => void }) {
 *   return <>{([
 *     ["temperature", "Temperature · 0–2"], ["top_p", "Top P · greater than 0, up to 1"], ["max_tokens", "Max output tokens · 64–4096"], ["seed", "Seed · optional, 0–2147483647"],
 *   ] as const).map(([name, label]) => <Field key={name} label={label} value={value[name]} keyboardType={name === "seed" || name === "max_tokens" ? "number-pad" : "decimal-pad"} onChangeText={s => change({ ...value, [name]: s })} />)}</>;
 * }
 * export default function AISettingsScreen() {
 *   const { data, repo } = useApp();
 *   const [aTemperature, setATemperature] = useState(String(data.settings.aTemperature));
 *   const [bParameters, setBParameters] = useState(draft(data.settings.bParameters));
 *   const [translationParameters, setTranslationParameters] = useState(draft(data.settings.translationParameters));
 *   const [bPrompt, setBPrompt] = useState(data.settings.bPrompt);
 *   const [translationPrompt, setTranslationPrompt] = useState(data.settings.translationPrompt);
 *   const [contextPrompt, setContextPrompt] = useState(data.settings.contextPrompt);
 *   const [saved, setSaved] = useState(false);
 *   const task = useTask();
 *   const dirty = aTemperature !== String(data.settings.aTemperature) || JSON.stringify(bParameters) !== JSON.stringify(draft(data.settings.bParameters)) || JSON.stringify(translationParameters) !== JSON.stringify(draft(data.settings.translationParameters)) || bPrompt !== data.settings.bPrompt || translationPrompt !== data.settings.translationPrompt || contextPrompt !== data.settings.contextPrompt;
 *   useUnsavedChanges(dirty);
 *   return <Screen>
 *     <Heading>AI settings</Heading><Body muted>Experiment with your selected models. Edited instructions replace the defaults; no hidden instruction is added. Languages and B1 → B2 are sent as separate request data.</Body>
 *     <Notice>Changing B instructions can weaken meaning preservation. Always check facts, negations and uncertainty in the result.</Notice>
 *     <Card><Heading small>A · Speech recognition</Heading><Field label="A temperature · 0–1" value={aTemperature} keyboardType="decimal-pad" onChangeText={setATemperature} />
 *       <Notice>OpenRouter's generic STT prompt is ignored by the endpoint, so no ineffective prompt editor is shown. A remains a transcription, not an improvement.</Notice>
 *     </Card>
 *     <Card><Heading small>B · Improve to B2</Heading><ParametersForm value={bParameters} change={setBParameters} />
 *       <Disclosure label="Edit B instruction"><Field label="B instruction" value={bPrompt} onChangeText={setBPrompt} multiline maxLength={20000} containerStyle={promptContainerStyle} style={[promptInputStyle, { minHeight: 240 }]} /></Disclosure>
 *     </Card>
 *     <Card><Heading small>Translation</Heading><Body muted>Used for Russian translation and contextual meanings. Both use model B.</Body><ParametersForm value={translationParameters} change={setTranslationParameters} />
 *       <Disclosure label="Edit full translation instruction"><Field label="Translation instruction" value={translationPrompt} onChangeText={setTranslationPrompt} multiline maxLength={20000} containerStyle={promptContainerStyle} style={[promptInputStyle, { minHeight: 190 }]} /></Disclosure>
 *       <Disclosure label="Edit contextual translation instruction"><Field label="Context instruction" value={contextPrompt} onChangeText={setContextPrompt} multiline maxLength={20000} containerStyle={promptContainerStyle} style={[promptInputStyle, { minHeight: 190 }]} /></Disclosure>
 *     </Card>
 *     <Button title={task.pending ? "Saving…" : "Save AI settings"} icon="check" disabled={task.pending} onPress={() => void task.run(async () => {
 *       if (!aTemperature.trim() || !Number.isFinite(Number(aTemperature))) throw new Error("A temperature must be a number from 0 to 1.");
 *       const result = settingsSchema.safeParse({ ...repo.snapshot().settings, aTemperature: Number(aTemperature), bParameters: parse(bParameters), translationParameters: parse(translationParameters), bPrompt, translationPrompt, contextPrompt });
 *       if (!result.success) throw new Error("Check temperature, Top P, token and seed ranges. All instructions must contain 1–20,000 characters.");
 *       await repo.update(d => { d.settings = result.data; }); setSaved(true);
 *     })} />
 *     {dirty && <Notice>Unsaved AI settings. Save before using these values.</Notice>}
 *     {saved && !dirty && <Notice>AI settings saved locally. Older B or Translation may now be out of date.</Notice>}
 *     {!!task.error && <Notice error>{task.error}</Notice>}
 *     <Body muted style={{ fontSize: 12 }}>Unsupported parameters are rejected before generation when known, or shown as a provider error. There are no automatic retries or silent substitutions.</Body>
 *   </Screen>;
 * }
 */

import { useEffect } from "react";
import { router } from "expo-router";

export default function AISettingsScreen() {
  useEffect(() => {
    router.replace("/settings");
  }, []);
  return null;
}
