const books = [
  { name: "Official Guidebook", 
    folder: "./Manuals/ICO-Official_guidebook/", pattern: "{n}_ICO_Official_Guidebook_{n}", extension: ".jpg", digits: 3, total: 100 },

  { name: "NTSC-U PS2",
    folder: "./Manuals/NTSC-U PS2 Manual/", pattern: "{n}", extension: ".jpeg", digits: 3, total: 36 },

  { name: "Japanese PS2",
    folder: "./Manuals/japanesePS2Manual/", pattern: "{n}", extension: ".png", digits: 1, total: 28 },

  { name: "PAL PS2",
    folder: "./Manuals/palPS2Manual/", pattern: "{n}", extension: ".jpg", digits: 1, total: 28 },

  { name: "Japanese PS3",
    folder: "./Manuals/japanesePS3Manual/", pattern: "{n}", extension: ".jpg", digits: 2, total: 28 },

  { name: "PAL PS3",
    folder: "./Manuals/PAL PS3 Manual/", pattern: "{n}", extension: ".jpg", digits: 1, total: 15 },

  { name: "Unofficial English Translation",
    folder: "./Manuals/unofficialEnTranslation/", pattern: "{n}", extension: ".jpg", digits: 2, total: 19 }
];

// ---------- Elements ----------
const chooser = document.getElementById("chooser");
const reader = document.getElementById("reader");
const book = document.getElementById("book");
const baseLeft = document.querySelector(".base-left");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const pageInfo = document.getElementById("pageInfo");
const backBtn = document.getElementById("backBtn");
const bookName = document.getElementById("bookName");
const choices = document.getElementById("choices");
const loader = document.getElementById("loader");
const loaderFill = document.getElementById("loaderFill");
const loaderCount = document.getElementById("loaderCount");
const loadName = document.getElementById("loadName");
const cancelLoad = document.getElementById("cancelLoad");

// ---------- Things that change while reading ----------
let current = null;  // the book that is open
let leaves = [];     // all the leaves (sheets of paper)
let angles = [];     // angle of each leaf: 0 = right side, 180 = left side
let frames = [];     // animation ids, so we can stop them
let total = 0;       // number of leaves that can flip
let pageCount = 0;   // number of real pages in the open book
let flipped = 0;     // how many leaves are on the left
let drag = null;     // info about the drag in progress
let loadToken = 0;   // lets us ignore a loading that was cancelled
const cache = {};    // images already downloaded, for each manual
let pageImgs = [];   // pageImgs[n] = the <img> of page n (loaded only when it is close)

// ---------- Loading settings (change these numbers if you like) ----------
const FIRST_LOAD = 6; // pages downloaded BEFORE the book opens
const AHEAD = 8;      // pages loaded in front of the page being read
const BEHIND = 4;     // pages kept loaded behind it

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- File names ----------
// example: 7 -> images/007_ICO_Official_Guidebook_007.jpg
function pagePath(b, number) {
  const num = String(number).padStart(b.digits, "0");
  return b.folder + b.pattern.split("{n}").join(num) + b.extension;
}

// ---------- Build the covers on the chooser with a loop ----------
books.forEach(function (b, index) {
  const button = document.createElement("button");
  button.className = "choice";
  button.innerHTML = '<img alt=""><span class="choice-label"></span><small></small>';

  button.querySelector(".choice-label").textContent = b.name;
  button.querySelector("small").textContent = b.subtitle;

  const cover = button.querySelector("img");
  cover.alt = b.name + " cover";
  cover.onload = cover.onerror = function () { cover.classList.add("loaded"); };
  cover.src = pagePath(b, 1);

  button.addEventListener("click", function () {
    openBook(index);
  });

  choices.appendChild(button);
});

// ---------- Build the pages with a loop ----------
function makePage(b, side, number) {
  const page = document.createElement("div");
  page.className = "page " + side + " scan";

  // a number higher than the total stays blank
  if (number <= b.total) {
    const img = document.createElement("img");
    img.dataset.src = pagePath(b, number); // downloaded later by loadNear()
    img.alt = "Page " + number;
    img.draggable = false;
    img.decoding = "async";
    pageImgs[number] = img;
    page.appendChild(img);
  }
  return page;
}

function buildBook(b, pages) {
  // remove the leaves of the previous book
  book.querySelectorAll(".leaf").forEach(function (leaf) { leaf.remove(); });
  leaves = [];
  angles = [];
  frames = [];
  flipped = 0;
  pageCount = pages;
  pageImgs = [];

  for (let p = 1; p <= pages; p += 2) {
    const leaf = document.createElement("div");
    leaf.className = "leaf";
    leaf.appendChild(makePage(b, "front", p));

    if (p + 1 <= pages) {
      leaf.appendChild(makePage(b, "back", p + 1));
    } else {
      // last page has nothing on its back: this leaf stays on the right
      leaf.classList.add("single");
    }

    book.appendChild(leaf);
    leaves.push(leaf);
    angles.push(0);
    attachDrag(leaf, leaves.length - 1);
  }

  // only leaves with a page on both sides can flip
  total = Math.floor(pages / 2);

  // make the book the same shape as the scans
  book.style.removeProperty("--ratio");
  const firstImg = new Image();
  firstImg.onload = function () {
    if (current === b) {
      book.style.setProperty("--ratio", firstImg.naturalHeight / firstImg.naturalWidth);
      render();
    }
  };
  firstImg.src = pagePath(b, 1);
}

// ---------- Open / close a book ----------
// downloads only the first few pages before the book opens.
// the other pages are loaded while the person reads (see loadNear below)
function preloadBook(b, onProgress) {
  return new Promise(function (resolve) {
    const count = Math.min(b.total, FIRST_LOAD);
    const images = [];
    let done = 0;

    function finish() {
      done++;
      onProgress(done, count);
      if (done === count) resolve(images);
    }

    for (let n = 1; n <= count; n++) {
      const img = new Image();
      img.onload = finish;
      img.onerror = finish;
      img.src = pagePath(b, n);
      images.push(img); // keep them so the browser doesn't forget them
    }
  });
}

// downloads the pages around the one being read (the nearest ones first)
function loadPage(n) {
  const img = pageImgs[n];
  if (img && !img.getAttribute("src")) {
    img.src = img.dataset.src;
  }
}

function loadNear() {
  if (pageImgs.length === 0) return;
  const centre = flipped * 2 + 1; // the right-hand page on screen
  for (let d = 0; d <= AHEAD; d++) {
    loadPage(centre + d);
    if (d <= BEHIND) loadPage(centre - d);
  }
}

function openBook(index) {
  // already downloaded before? open right away
  if (cache[index]) {
    showBook(index);
    return;
  }

  const b = books[index];
  const myToken = ++loadToken;

  chooser.classList.add("hidden");
  loader.classList.remove("hidden");
  loadName.textContent = b.name;
  loaderFill.style.width = "0%";
  loaderCount.textContent = "Loading pages 0 / " + Math.min(b.total, FIRST_LOAD);

  const startTime = performance.now();

  preloadBook(b, function (done, count) {
    loaderFill.style.width = (done / count * 100) + "%";
    loaderCount.textContent = "Loading pages " + done + " / " + count;
  }).then(function (images) {
    cache[index] = { images: images, pages: b.total };

    // keep the loading screen for at least 0.6s so it doesn't flash
    const wait = Math.max(0, 600 - (performance.now() - startTime));
    setTimeout(function () {
      if (myToken === loadToken) showBook(index); // skip if cancelled
    }, wait);
  });
}

function showBook(index) {
  current = books[index];
  document.body.classList.add("reading"); // hides the big title so the book can be bigger

  loader.classList.add("hidden");
  chooser.classList.add("hidden");
  reader.classList.remove("hidden");
  bookName.textContent = current.name;

  // play the drop-in animation again
  book.style.animation = "none";
  void book.offsetWidth;
  book.style.animation = "";

  buildBook(current, cache[index].pages);
  render();
  updateUI();
  window.scrollTo(0, 0);
}

function closeBook() {
  loadToken++; // cancels a loading in progress
  document.body.classList.remove("reading");
  loader.classList.add("hidden");
  frames.forEach(function (id) { cancelAnimationFrame(id); });
  drag = null;
  current = null;

  reader.classList.add("hidden");
  chooser.classList.remove("hidden");
}

backBtn.addEventListener("click", closeBook);
cancelLoad.addEventListener("click", closeBook);

// ---------- Draw everything from the angles ----------
function render() {
  if (leaves.length === 0) return;

  leaves.forEach(function (leaf, i) {
    const a = angles[i];
    leaf.style.transform = "rotateY(" + (-a) + "deg)";
    leaf.style.setProperty("--shade", Math.sin(a * Math.PI / 180) * 0.45);
    leaf.style.zIndex = a > 90 ? 10 + i : 10 + leaves.length - i;
  });

  // slide the book so the closed cover (and the back) stay centered
  const pageW = book.offsetWidth / 2;
  const first = total > 0 ? angles[0] / 180 : 0;
  const last = total > 0 ? angles[total - 1] / 180 : 0;
  book.style.translate = ((first + last - 1) * pageW / 2) + "px 0";

  baseLeft.style.opacity = first;
}

// ---------- Animate one leaf to 0 or 180 ----------
function animateTo(i, target) {
  cancelAnimationFrame(frames[i]);

  const from = angles[i];
  const start = performance.now();
  const duration = reduceMotion ? 1 : Math.max(300, 1000 * Math.abs(target - from) / 180);

  function step(now) {
    const t = Math.min((now - start) / duration, 1);
    const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    angles[i] = from + (target - from) * e;
    render();
    if (t < 1) {
      frames[i] = requestAnimationFrame(step);
    }
  }
  frames[i] = requestAnimationFrame(step);
}

// ---------- Buttons and label ----------
function updateUI() {
  loadNear();
  prevBtn.disabled = flipped === 0;
  nextBtn.disabled = flipped >= total;

  if (flipped === 0) {
    pageInfo.textContent = "Cover";
  } else {
    const left = flipped * 2;
    const right = left + 1;
    if (right > pageCount) {
      pageInfo.textContent = "Page " + left;
    } else {
      pageInfo.textContent = "Pages " + left + "-" + right;
    }
  }
}

function next() {
  if (flipped < total) {
    animateTo(flipped, 180);
    flipped++;
    updateUI();
  }
}

function prev() {
  if (flipped > 0) {
    flipped--;
    animateTo(flipped, 0);
    updateUI();
  }
}

nextBtn.addEventListener("click", next);
prevBtn.addEventListener("click", prev);

document.addEventListener("keydown", function (e) {
  if (!current) return; // only when a book is open
  if (e.key === "ArrowRight") next();
  if (e.key === "ArrowLeft") prev();
});

// ---------- Dragging a page with mouse or finger ----------
function attachDrag(leaf, i) {

  leaf.addEventListener("dragstart", function (e) { e.preventDefault(); });

  leaf.addEventListener("pointerdown", function (e) {
    // you can only grab the top page of each pile (and never the single last page)
    if (i >= total && i !== flipped - 1) return;
    if (i !== flipped && i !== flipped - 1) return;

    cancelAnimationFrame(frames[i]);
    leaf.setPointerCapture(e.pointerId);
    leaf.classList.add("dragging");

    const spineX = book.getBoundingClientRect().left + book.offsetWidth / 2;

    drag = {
      index: i,
      spineX: spineX,
      grab: Math.max(Math.abs(e.clientX - spineX), 40), // distance from the spine
      startX: e.clientX,
      moved: 0,
      lastAngle: angles[i],
      lastTime: performance.now(),
      speed: 0
    };
  });

  leaf.addEventListener("pointermove", function (e) {
    if (!drag || drag.index !== i) return;

    // the grabbed spot follows the pointer
    let c = (e.clientX - drag.spineX) / drag.grab;
    c = Math.max(-1, Math.min(1, c));
    const angle = Math.acos(c) * 180 / Math.PI;

    const now = performance.now();
    const dt = now - drag.lastTime;
    if (dt > 0) {
      drag.speed = (angle - drag.lastAngle) / dt; // degrees per millisecond
    }
    drag.lastAngle = angle;
    drag.lastTime = now;
    drag.moved = Math.max(drag.moved, Math.abs(e.clientX - drag.startX));

    angles[i] = angle;
    render();
  });

  function release() {
    if (!drag || drag.index !== i) return;
    leaf.classList.remove("dragging");

    let target;
    if (drag.moved < 6) {
      target = i === flipped ? 180 : 0; // a click flips the page
    } else {
      let speed = drag.speed;
      if (performance.now() - drag.lastTime > 100) speed = 0; // stopped before letting go

      if (speed > 0.1) {
        target = 180;
      } else if (speed < -0.1) {
        target = 0;
      } else {
        target = angles[i] > 90 ? 180 : 0; // closest side
      }
    }

    flipped = target === 180 ? i + 1 : i;
    animateTo(i, target);
    updateUI();
    drag = null;
  }

  leaf.addEventListener("pointerup", release);
  leaf.addEventListener("pointercancel", release);
}

window.addEventListener("resize", render);
