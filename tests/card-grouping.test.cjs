const assert = require("node:assert/strict");
const test = require("node:test");
const { importTypeScript } = require("./load-typescript.cjs");

test("groups cards by front after a grid grows while preserving their order", async () => {
  const { groupCardsByFront, initialState } = await importTypeScript("../src/tools/CardPrinter/logic/model.ts");
  const state = initialState();
  state.sprites = [
    { id: "front-a", columns: 3, rows: 1 },
    { id: "front-b", columns: 2, rows: 1 },
  ];
  state.cardOrder = ["front-b:1", "front-a:1", "front-b:0", "front-a:0"];

  groupCardsByFront(state);

  assert.deepEqual(state.cardOrder, ["front-b:1", "front-b:0", "front-a:1", "front-a:0", "front-a:2"]);
});
