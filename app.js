(() => {
  const M = globalThis.CantineMenu;
  const $ = (id) => document.getElementById(id);
  const ui = {
    masthead: $("masthead"),
    theme: $("theme"),
    footer: document.querySelector("footer"),
    dayNav: $("day-nav"),
    prevDay: $("prev-day"),
    nextDay: $("next-day"),
    weekLabel: $("week-label"),
    prev: $("prev-week"),
    next: $("next-week"),
    thisWeek: $("this-week"),
    status: $("status"),
    retry: $("retry"),
    days: $("days"),
    school: $("school"),
    schoolInputs: [...document.querySelectorAll('input[name="school"]')],
    schoolName: $("school-name"),
  };

  const SCHOOL_KEY = "cantine.school";
  const THEME_KEY = "cantine.theme";
  const SCHOOL_NAMES = { primaire: "primaires", maternelle: "maternelles" };

  const today = M.toIsoDate(new Date());
  const currentMonday = M.weekStart(new Date());
  let monday = currentMonday;
  let controller = null;
  let revealToday = true;

  function readSetting(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function saveSetting(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {}
  }

  // The script in index.html sets the starting theme; this keeps the button in sync with it.
  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    ui.theme.setAttribute("aria-pressed", String(theme === "dark"));
  }

  const checkedSchool = () => ui.schoolInputs.find((input) => input.checked).value;
  const savedInput = ui.schoolInputs.find((input) => input.value === readSetting(SCHOOL_KEY));
  if (savedInput) savedInput.checked = true;
  let school = checkedSchool();

  function showSchoolName() {
    ui.schoolName.textContent = SCHOOL_NAMES[school];
    document.title = `La Cantoche rose, menu des écoles ${SCHOOL_NAMES[school]} de Toulouse`;
  }

  function setStatus(message, canRetry = false) {
    ui.status.textContent = message;
    ui.retry.hidden = !canRetry;
  }

  function renderCourse(course) {
    const group = document.createElement("div");
    group.className = "course";
    const term = document.createElement("dt");
    term.textContent = course.label;
    group.append(term);
    course.dishes.forEach((dish, index) => {
      const item = document.createElement("dd");
      if (index > 0) {
        const or = document.createElement("span");
        or.className = "or";
        or.textContent = "ou ";
        item.append(or);
      }
      item.append(dish);
      group.append(item);
    });
    return group;
  }

  function renderDay(day) {
    const section = document.createElement("section");
    section.className = "day";
    if (day.date === today) {
      section.classList.add("today");
      section.setAttribute("aria-current", "date");
    }
    const title = document.createElement("h2");
    title.className = "indent";
    const titleText = document.createElement("span");
    titleText.textContent = M.formatDayTitle(day.date);
    if (day.date === today) titleText.className = "marker";
    title.append(titleText);
    const list = document.createElement("dl");
    list.append(...day.courses.map(renderCourse));
    section.append(title, list);
    return section;
  }

  // Signed distance between a day and its resting place, a little under the masthead's ruler.
  function offsetFromMasthead(day) {
    const gap = parseFloat(getComputedStyle(day).scrollMarginTop);
    return day.getBoundingClientRect().top - ui.masthead.offsetHeight - gap;
  }

  function scrollToDay(day, behavior = "auto") {
    window.scrollTo({ top: window.scrollY + offsetFromMasthead(day), behavior });
  }

  const motion = () => (matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");
  const dayList = () => [...ui.days.children];
  const dayBelow = () => dayList().find((day) => offsetFromMasthead(day) > 1);
  const dayAbove = () => dayList().findLast((day) => offsetFromMasthead(day) < -1);

  // style.css pads the page end from this so the last day can still scroll up to the ruler.
  function measureEnd() {
    const last = ui.days.lastElementChild;
    const root = document.documentElement.style;
    if (!last) return root.removeProperty("--last-day-to-end");
    const height = ui.footer.getBoundingClientRect().bottom - last.getBoundingClientRect().top;
    root.setProperty("--last-day-to-end", `${height}px`);
  }

  // Waits for fonts so a late font swap can't change wrapping after the scroll.
  async function scrollToToday() {
    await document.fonts.ready;
    measureEnd();
    const day = ui.days.querySelector(".today");
    if (day && day.getBoundingClientRect().bottom > window.innerHeight) scrollToDay(day);
  }

  function updateScrollUi() {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    ui.dayNav.hidden = ui.days.childElementCount === 0;
    ui.prevDay.disabled = window.scrollY <= 0;
    ui.nextDay.disabled = window.scrollY >= maxScroll - 1 || !dayBelow();
    ui.masthead.classList.toggle("scrolled", window.scrollY > 0);
  }

  async function load() {
    controller?.abort();
    controller = new AbortController();
    ui.weekLabel.textContent = M.formatWeekLabel(monday);
    ui.thisWeek.hidden = monday.getTime() === currentMonday.getTime();
    ui.days.replaceChildren();
    measureEnd();
    updateScrollUi();
    setStatus("Chargement du menu…");
    try {
      const response = await fetch(M.buildQueryUrl(monday, school), { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const { results } = await response.json();
      const days = M.groupMenu(results);
      ui.days.replaceChildren(...days.map(renderDay));
      setStatus(days.length ? "" : "Aucun menu publié pour cette semaine.");
      measureEnd();
      updateScrollUi();
      if (revealToday) {
        revealToday = false;
        scrollToToday();
      }
    } catch (error) {
      if (error.name === "AbortError") return;
      setStatus("Le menu n’a pas pu être chargé. Vérifiez votre connexion puis réessayez.", true);
    }
  }

  function showWeek(newMonday, reveal = false) {
    monday = newMonday;
    revealToday = reveal;
    load();
  }

  ui.prev.addEventListener("click", () => showWeek(M.addDays(monday, -7)));
  ui.next.addEventListener("click", () => showWeek(M.addDays(monday, 7)));
  ui.thisWeek.addEventListener("click", () => showWeek(currentMonday, true));
  ui.retry.addEventListener("click", load);
  // The switch stays reachable while scrolled, and reloading empties the page, so land on today again.
  ui.school.addEventListener("change", () => {
    school = checkedSchool();
    saveSetting(SCHOOL_KEY, school);
    showSchoolName();
    showWeek(monday, true);
  });
  ui.theme.addEventListener("click", () => {
    const theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    saveSetting(THEME_KEY, theme);
    applyTheme(theme);
  });
  // Follows the system until a theme is picked with the button.
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (event) => {
    if (!readSetting(THEME_KEY)) applyTheme(event.matches ? "dark" : "light");
  });
  ui.prevDay.addEventListener("click", () => {
    const day = dayAbove();
    if (day) scrollToDay(day, motion());
    else window.scrollTo({ top: 0, behavior: motion() });
  });
  ui.nextDay.addEventListener("click", () => {
    const day = dayBelow();
    if (day) scrollToDay(day, motion());
  });
  window.addEventListener("scroll", updateScrollUi, { passive: true });
  window.addEventListener("resize", () => {
    measureEnd();
    updateScrollUi();
  });
  new ResizeObserver(() => {
    document.documentElement.style.setProperty("--masthead-height", `${ui.masthead.offsetHeight}px`);
  }).observe(ui.masthead);
  applyTheme(document.documentElement.dataset.theme);
  showSchoolName();
  load();
})();
