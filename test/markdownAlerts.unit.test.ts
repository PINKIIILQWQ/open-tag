import test from "node:test";
import assert from "node:assert/strict";
import { remarkGithubAlerts } from "../web/src/messageRender.tsx";

function runAlertTransform(tree: any): any {
  const transform = remarkGithubAlerts();
  transform(tree);
  return tree;
}

test("GitHub alert blockquotes get a typed class and lose the marker line", () => {
  const tree = {
    type: "root",
    children: [{
      type: "blockquote",
      children: [
        { type: "paragraph", children: [{ type: "text", value: "[!WARNING]" }] },
        { type: "paragraph", children: [{ type: "text", value: "Watch the context before replying." }] },
      ],
    }],
  };

  runAlertTransform(tree);

  const quote = tree.children[0];
  assert.deepEqual(quote.data.hProperties.className, ["github-alert", "github-alert-warning"]);
  assert.deepEqual(quote.data.hProperties["data-alert"], "warning");
  assert.equal(quote.children.length, 1);
  assert.equal(quote.children[0].children[0].value, "Watch the context before replying.");
});

test("ordinary blockquotes are not converted into alerts", () => {
  const tree = {
    type: "root",
    children: [{
      type: "blockquote",
      children: [{ type: "paragraph", children: [{ type: "text", value: "Just quoted text." }] }],
    }],
  };

  runAlertTransform(tree);

  assert.equal(tree.children[0].data, undefined);
  assert.equal(tree.children[0].children[0].children[0].value, "Just quoted text.");
});
