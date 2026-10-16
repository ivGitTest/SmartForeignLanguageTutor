/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const file = new URL("../app/material/[id].tsx", import.meta.url);
const sourceText = fs.readFileSync(file, "utf8");
const source = ts.createSourceFile(
  file.pathname,
  sourceText,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);

function jsxAttribute(node: ts.JsxOpeningLikeElement, name: string) {
  return node.attributes.properties.find(
    (attribute): attribute is ts.JsxAttribute =>
      ts.isJsxAttribute(attribute) && attribute.name.getText(source) === name,
  );
}

test("only B improved exposes text selection for dictionary lookup", () => {
  let originalA: ts.JsxOpeningLikeElement | undefined;
  let improvedB: ts.JsxOpeningLikeElement | undefined;

  function visit(node: ts.Node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(source);
      if (
        tag === "Field" &&
        jsxAttribute(node, "label")?.initializer?.getText(source) === '"A · editable transcript"'
      ) originalA = node;
      if (tag === "SelectableTranscript") improvedB = node;
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  assert.ok(originalA, "A · editable transcript must be present.");
  assert.ok(improvedB, "B must remain selectable for contextual translation.");
  assert.equal(
    jsxAttribute(originalA, "onSelectionChange"),
    undefined,
    "A must not create a selection or expose the dictionary lookup card.",
  );
  assert.ok(
    jsxAttribute(improvedB, "onSelect"),
    "B · Improved must retain its contextual translation and dictionary action.",
  );
});

test("contextual dictionary button stays beside a shrinkable selected expression", () => {
  assert.match(
    sourceText,
    /<Row style=\{\{ alignItems: "flex-start" \}\}>\s*<View style=\{\{ flex: 1, minWidth: 0 \}\}>\s*<Heading small>\{selection\.expression\}<\/Heading>\s*<\/View>\s*<IconButton name=\{added \? "bookmark" : "bookmark-add"\}/,
  );
});
