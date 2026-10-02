const assert = require("node:assert/strict");
const test = require("node:test");
const { importTypeScript } = require("./load-typescript.cjs");

test("localization uses the hash locale and route, with English fallback", async () => {
  const { normalizeLocation, translate } = await importTypeScript("../src/localization.ts");
  assert.deepEqual(normalizeLocation("#it-IT/card-printer"), { locale: "it-IT", route: "card-printer" });
  assert.deepEqual(normalizeLocation("#invalid/unknown"), { locale: "en-GB", route: "home" });
  assert.equal(translate("it-IT", "card-printer", "howItWorks"), "Come funziona");
  assert.equal(translate("en-GB", "pdf-booklet", "choosePdf"), "Choose PDF");
  assert.equal(translate("it-IT", "home", "missingKey"), "missingKey");
  assert.equal(translate("it-IT", "card-printer", "selectedCards", {}), "carte selezionate");
  assert.equal(translate("it-IT", "card-printer", "spritePlaceholder", { number: 3 }), "Fronte 3");
  assert.equal(translate("it-IT", "card-printer", "spriteLoaded", { count: 1 }), "1 file caricato");
  assert.equal(translate("en-GB", "card-printer", "spritesLoaded", { count: 2 }), "2 files loaded");
  assert.equal(translate("it-IT", "card-printer", "showUnprintableCard", { count: 1 }), "Mostra 1 carta non stampabile");
});

test("English and Italian dictionaries contain the same messages", async () => {
  for (const directory of ["../src/home/lang", "../src/tools/PdfBooklet/lang", "../src/tools/CardPrinter/lang"]) {
    const english = (await importTypeScript(`${directory}/en.ts`)).default;
    const italian = (await importTypeScript(`${directory}/it.ts`)).default;
    assert.deepEqual(Object.keys(italian).sort(), Object.keys(english).sort(), directory);
    for (const key of Object.keys(english)) {
      const placeholders = (message) => [...message.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
      assert.deepEqual(placeholders(italian[key]), placeholders(english[key]), `${directory}: ${key}`);
    }
  }
});
