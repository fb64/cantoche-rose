const test = require("node:test");
const assert = require("node:assert/strict");
require("./menu.js");

const M = globalThis.CantineMenu;
const day = (y, m, d) => new Date(y, m - 1, d);

test("weekStart returns the Monday of the current week on weekdays", () => {
  assert.equal(M.toIsoDate(M.weekStart(day(2026, 10, 5))), "2026-10-05");
  assert.equal(M.toIsoDate(M.weekStart(day(2026, 10, 6))), "2026-10-05");
  assert.equal(M.toIsoDate(M.weekStart(day(2026, 10, 9))), "2026-10-05");
});

test("weekStart jumps to next Monday on weekends", () => {
  assert.equal(M.toIsoDate(M.weekStart(day(2026, 10, 10))), "2026-10-12");
  assert.equal(M.toIsoDate(M.weekStart(day(2026, 10, 11))), "2026-10-12");
});

test("weekStart crosses month and year boundaries", () => {
  assert.equal(M.toIsoDate(M.weekStart(day(2026, 1, 1))), "2025-12-29");
  assert.equal(M.toIsoDate(M.weekStart(day(2026, 10, 31))), "2026-11-02");
});

test("addDays moves across months", () => {
  assert.equal(M.toIsoDate(M.addDays(day(2026, 9, 28), 7)), "2026-10-05");
  assert.equal(M.toIsoDate(M.addDays(day(2026, 10, 5), -7)), "2026-09-28");
});

test("buildQueryUrl filters lunch, primary and the Monday-Sunday range", () => {
  const url = new URL(M.buildQueryUrl(day(2026, 10, 5)));
  assert.equal(url.origin + url.pathname,
    "https://data.toulouse-metropole.fr/api/explore/v2.1/catalog/datasets/menus/records");
  const where = url.searchParams.get("where");
  assert.match(where, /datemenu >= date'2026-10-05'/);
  assert.match(where, /datemenu <= date'2026-10-11'/);
  assert.match(where, /libelle_repas = "REPAS MIDI"/);
  assert.match(where, /libelle_population_cible = "\.Primaire"/);
  assert.equal(url.searchParams.get("order_by"), "datemenu, ordre_plat");
  assert.equal(url.searchParams.get("limit"), "100");
});

test("buildQueryUrl targets kindergartens when asked", () => {
  const where = new URL(M.buildQueryUrl(day(2026, 10, 5), "maternelle")).searchParams.get("where");
  assert.match(where, /libelle_population_cible = "\.Maternelle"/);
  assert.match(where, /libelle_repas = "REPAS MIDI"/);
});

test("formatDish turns caps into sentence case and collapses spaces", () => {
  assert.equal(M.formatDish("TOMATES  VINAIGRETTE "), "Tomates vinaigrette");
  assert.equal(M.formatDish("POIS CHICHE AUX LEGUMES"), "Pois chiche aux légumes");
});

test("formatDish restores accents on known words", () => {
  assert.equal(M.formatDish("EMINCE VEGETAL  A LA PROVENCALE"), "Émincé végétal à la provençale");
  assert.equal(M.formatDish("PUREE DE POTIMARON et CHATAIGNE "), "Purée de potimarron et châtaigne");
  assert.equal(M.formatDish("POISSON PANE CUIT / CITRON"), "Poisson pané cuit / citron");
  assert.equal(M.formatDish("FILET DE CAILLE CREME DE CEPE"), "Filet de caille crème de cèpe");
  assert.equal(M.formatDish("EMINCE DE BOEUF PROVENCAL"), "Émincé de bœuf provençal");
  assert.equal(M.formatDish("TOME PYRENEES"), "Tome Pyrénées");
  assert.equal(M.formatDish("PUREE FRUIT SANS SUCRES AJOUTES POMME/ANANAS"),
    "Purée fruit sans sucres ajoutés pomme/ananas");
});

test("formatDish ignores words that only exist on Object.prototype", () => {
  assert.equal(M.formatDish("CONSTRUCTOR TOSTRING"), "Constructor tostring");
});

test("formatDish restores elided articles before a vowel", () => {
  assert.equal(M.formatDish("HARICOTS PLATS D ESPAGNE"), "Haricots plats d’Espagne");
  assert.equal(M.formatDish("JUS L ORANGE"), "Jus l’orange");
});

test("formatDish does not elide before an h", () => {
  assert.equal(M.formatDish("SALADE D HARICOTS"), "Salade d haricots");
});

test("formatDayTitle gives a capitalized French date", () => {
  assert.equal(M.formatDayTitle("2026-10-06"), "Mardi 6 octobre");
});

test("formatWeekLabel spans Monday to Friday", () => {
  assert.equal(M.formatWeekLabel(day(2026, 10, 5)), "Semaine du 5 au 9 octobre");
  assert.equal(M.formatWeekLabel(day(2026, 9, 28)), "Semaine du 28 septembre au 2 octobre");
});

const record = (date, ordre, libelleOrdre, plat) => ({
  datemenu: `${date}T00:00:00+00:00`,
  ordre_plat: ordre,
  libelle_ordre_plat: libelleOrdre,
  libelle_plat: plat,
});

test("groupMenu groups by day then course, sorted, without bread", () => {
  const records = [
    record("2026-10-06", 5, "05-DESSERTS", "FRUIT"),
    record("2026-10-05", 1, "01-ENTREES", "TOMATES VINAIGRETTE"),
    record("2026-10-06", 2, "02-VIANDES", "EMINCE DE BOEUF PROVENCAL"),
    record("2026-10-06", 6, "06-PAIN", "BAGUETTE"),
    record("2026-10-06", 2, "02-VIANDES", "EMINCE VEGETAL A LA PROVENCALE"),
  ];
  assert.deepEqual(M.groupMenu(records), [
    { date: "2026-10-05", courses: [{ label: "Entrée", dishes: ["Tomates vinaigrette"] }] },
    {
      date: "2026-10-06",
      courses: [
        { label: "Plat", dishes: ["Émincé de bœuf provençal", "Émincé végétal à la provençale"] },
        { label: "Dessert", dishes: ["Fruit"] },
      ],
    },
  ]);
});

test("groupMenu names all known courses", () => {
  const records = [1, 2, 3, 4, 5, 7].map((n) => record("2026-10-05", n, "", "X"));
  const labels = M.groupMenu(records)[0].courses.map((c) => c.label);
  assert.deepEqual(labels, ["Entrée", "Plat", "Accompagnement", "Laitage", "Dessert", "Goûter"]);
});

test("groupMenu falls back to the API course label for unknown courses", () => {
  const [{ courses }] = M.groupMenu([record("2026-10-05", 8, "08-COLLATION", "COMPOTE")]);
  assert.deepEqual(courses, [{ label: "Collation", dishes: ["Compote"] }]);
});

test("groupMenu returns an empty list for an empty week", () => {
  assert.deepEqual(M.groupMenu([]), []);
});
