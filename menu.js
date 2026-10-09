(() => {
  const API_URL = "https://data.toulouse-metropole.fr/api/explore/v2.1/catalog/datasets/menus/records";
  const BREAD = 6;
  const COURSE_LABELS = { 1: "Entrée", 2: "Plat", 3: "Accompagnement", 4: "Laitage", 5: "Dessert", 7: "Goûter" };
  const POPULATIONS = { primaire: ".Primaire", maternelle: ".Maternelle" };

  // The API strips accents. Ambiguous words (pate: pâte or pâté?) are left out on purpose.
  const ACCENTS = new Map(Object.entries({
    a: "à", ajoute: "ajouté", ajoutee: "ajoutée", ajoutes: "ajoutés", ajoutees: "ajoutées",
    allege: "allégé", allegee: "allégée", bearnaise: "béarnaise", bechamel: "béchamel", ble: "blé",
    boeuf: "bœuf", brasse: "brassé", brulee: "brûlée", cafe: "café", celeri: "céleri",
    cepe: "cèpe", cepes: "cèpes", cereales: "céréales", chataigne: "châtaigne", chataignes: "châtaignes",
    chevre: "chèvre", coeur: "cœur", cote: "côte", cotes: "côtes", creme: "crème", cremes: "crèmes",
    cremeux: "crémeux", creole: "créole", cuillere: "cuillère", dore: "doré", doree: "dorée",
    eclair: "éclair", ecrase: "écrasé", ecrasee: "écrasée", emince: "émincé", emincee: "émincée",
    eminces: "émincés", epice: "épicé", epicee: "épicée", epices: "épices", epinard: "épinard",
    epinards: "épinards", espagne: "Espagne", fete: "fête", fraiche: "fraîche", gateau: "gâteau",
    gateaux: "gâteaux", gouter: "goûter", gratine: "gratiné", gratinee: "gratinée", gratines: "gratinés",
    gruyere: "gruyère", hache: "haché", hachee: "hachée", haches: "hachés", legume: "légume",
    legumes: "légumes", liegeois: "liégeois", macedoine: "macédoine", mache: "mâche", mais: "maïs",
    marinee: "marinée", mediterraneen: "méditerranéen", mediterraneenne: "méditerranéenne",
    melange: "mélange", nicoise: "niçoise", noel: "Noël", oeuf: "œuf", oeufs: "œufs",
    pane: "pané", panee: "panée", panes: "panés", pates: "pâtes", peche: "pêche", peches: "pêches",
    persille: "persillé", persillee: "persillée", persilles: "persillés", poele: "poêlé", poelee: "poêlée",
    potimaron: "potimarron", provencal: "provençal", provencale: "provençale", puree: "purée",
    pyrenees: "Pyrénées", rape: "râpé", rapee: "râpée", rapes: "râpés", rapees: "râpées",
    roti: "rôti", rotie: "rôtie", rotis: "rôtis", sale: "salé", salee: "salée", saute: "sauté",
    sautee: "sautée", sautes: "sautés", sucree: "sucrée", vegetal: "végétal", vegetale: "végétale",
    vegetarien: "végétarien", vegetarienne: "végétarienne", veloute: "velouté",
  }));

  const dayTitleFormat = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const monthFormat = new Intl.DateTimeFormat("fr-FR", { month: "long" });

  const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

  function addDays(date, days) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
  }

  // Saturday and Sunday look ahead to the coming week.
  function weekStart(date) {
    const weekday = date.getDay();
    const offset = weekday === 6 ? 2 : weekday === 0 ? 1 : 1 - weekday;
    return addDays(date, offset);
  }

  function toIsoDate(date) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function fromIsoDate(iso) {
    const [year, month, day] = iso.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  function buildQueryUrl(monday, school = "primaire") {
    const where = [
      `datemenu >= date'${toIsoDate(monday)}'`,
      `datemenu <= date'${toIsoDate(addDays(monday, 6))}'`,
      `libelle_repas = "REPAS MIDI"`,
      `libelle_population_cible = "${POPULATIONS[school]}"`,
    ].join(" and ");
    const url = new URL(API_URL);
    url.searchParams.set("where", where);
    url.searchParams.set("order_by", "datemenu, ordre_plat");
    url.searchParams.set("limit", "100");
    return url.toString();
  }

  // The API also turns apostrophes into spaces: "D ESPAGNE" is "d’Espagne". Never before an h ("d haricots").
  function formatDish(label) {
    const text = label.trim().replace(/\s+/g, " ").toLowerCase()
      .replace(/(^|\s)([dl]) (?=[aeiouyàâéèêëîïôûœ])/gu, "$1$2’")
      .replace(/\p{L}+/gu, (word) => ACCENTS.get(word) ?? word);
    return capitalize(text);
  }

  function formatDayTitle(iso) {
    return capitalize(dayTitleFormat.format(fromIsoDate(iso)));
  }

  function formatWeekLabel(monday) {
    const friday = addDays(monday, 4);
    const fridayPart = `${friday.getDate()} ${monthFormat.format(friday)}`;
    const mondayPart = monday.getMonth() === friday.getMonth()
      ? `${monday.getDate()}`
      : `${monday.getDate()} ${monthFormat.format(monday)}`;
    return `Semaine du ${mondayPart} au ${fridayPart}`;
  }

  function courseLabel(record) {
    return COURSE_LABELS[record.ordre_plat] ?? formatDish(record.libelle_ordre_plat.replace(/^\d+-/, ""));
  }

  function groupMenu(records) {
    const days = new Map();
    for (const record of records) {
      if (record.ordre_plat === BREAD) continue;
      const date = record.datemenu.slice(0, 10);
      if (!days.has(date)) days.set(date, new Map());
      const courses = days.get(date);
      if (!courses.has(record.ordre_plat)) {
        courses.set(record.ordre_plat, { label: courseLabel(record), dishes: [] });
      }
      courses.get(record.ordre_plat).dishes.push(formatDish(record.libelle_plat));
    }
    return [...days.keys()].sort().map((date) => ({
      date,
      courses: [...days.get(date).entries()].sort(([a], [b]) => a - b).map(([, course]) => course),
    }));
  }

  globalThis.CantineMenu = {
    addDays,
    weekStart,
    toIsoDate,
    buildQueryUrl,
    formatDish,
    formatDayTitle,
    formatWeekLabel,
    groupMenu,
  };
})();
