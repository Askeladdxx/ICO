// ---------- SETTINGS: the manual shown on the home page ----------
// Copy these from the first manual in manual.js (name, folder, pattern, total...).
// total must be the real number of pages.
const preview = {
  name: "Official Guidebook · Japanese",
  folder: "./Manuals/ICO-Official_guidebook/",
  pattern: "{n}_ICO_Official_Guidebook_{n}", // {n} becomes the page number
  extension: ".jpg",
  digits: 3,
  total: 100
};

(function () {
  const book = document.getElementById("mpBook");
  if (!book) return; // the Manuals section is not on this page

  const baseLeft = book.querySelector(".mp-base");
  const prevBtn = document.getElementById("mpPrev");
  const nextBtn = document.getElementById("mpNext");
  const pageInfo = document.getElementById("mpInfo");
  const section = document.getElementById("manuals");

  document.getElementById("mpName").textContent = preview.name;

  const tip = document.getElementById("mpCursor");   // label that follows the mouse
  const swipe = document.getElementById("mpSwipe");  // hint for touch screens
  let turns = 0;                                     // how many pages the visitor has turned

  let leaves = [];     // the sheets of paper
  let angles = [];     // 0 = flat on the right, 180 = flat on the left
  let frames = [];     // animation ids
  let flippable = 0;   // leaves that have a page on both sides
  let flipped = 0;     // leaves on the left
  let drag = null;     // the drag in progress
  let inView = false;  // is the Manuals section on screen?

  const AHEAD = 6; // how many pages ahead we download (the book has 100 pages, so we load a few at a time)
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- Pages ----------
  function pagePath(n) {
    const num = String(n).padStart(preview.digits, "0");
    return preview.folder + preview.pattern.split("{n}").join(num) + preview.extension;
  }

  function makePage(side, n) {
    const page = document.createElement("div");
    page.className = "mp-page " + side;

    if (n <= preview.total) {
      const img = document.createElement("img");
      img.alt = "Page " + n;
      img.draggable = false;
      img.dataset.src = pagePath(n);   // the real src is set later (loadUpTo)
      img.dataset.page = n;
      img.addEventListener("error", function () { img.classList.add("broken"); });
      page.appendChild(img);
    }
    return page;
  }

  // downloads the pages up to number n (the ones not downloaded yet)
  function loadUpTo(n) {
    book.querySelectorAll("img[data-src]").forEach(function (img) {
      if (Number(img.dataset.page) <= n) {
        img.src = img.dataset.src;
        img.removeAttribute("data-src");
      }
    });
  }

  // ---------- Build the leaves with a loop ----------
  for (let p = 1; p <= preview.total; p += 2) {
    const leaf = document.createElement("div");
    leaf.className = "mp-leaf";
    leaf.appendChild(makePage("mp-front", p));

    if (p + 1 <= preview.total) {
      leaf.appendChild(makePage("mp-back", p + 1));
    } else {
      leaf.classList.add("single"); // last page with nothing on its back: it stays put
    }

    book.appendChild(leaf);
    leaves.push(leaf);
    angles.push(0);
    attachDrag(leaf, leaves.length - 1);
  }
  flippable = Math.floor(preview.total / 2);

  // make the book the same shape as the scans
  const firstImg = book.querySelector('img[data-page="1"]');
  if (firstImg) {
    firstImg.addEventListener("load", function () {
      book.style.setProperty("--ratio", firstImg.naturalHeight / firstImg.naturalWidth);
      render();
    });
  }

  // ---------- Draw everything from the angles ----------
  function render() {
    if (leaves.length === 0) return;

    leaves.forEach(function (leaf, i) {
      const a = angles[i];
      leaf.style.transform = "rotateY(" + (-a) + "deg)";
      leaf.style.setProperty("--shade", Math.sin(a * Math.PI / 180) * 0.45);
      leaf.style.zIndex = a > 90 ? 10 + i : 10 + leaves.length - i;
    });

    // slide the book so the closed cover (and the back cover) stay centered
    const pageW = book.offsetWidth / 2;
    const first = flippable > 0 ? angles[0] / 180 : 0;
    const last = flippable > 0 ? angles[flippable - 1] / 180 : 0;
    book.style.translate = ((first + last - 1) * pageW / 2) + "px 0";

    baseLeft.style.opacity = first;
  }

  // ---------- Animate one leaf to 0 or 180 ----------
  function animateTo(i, target) {
    cancelAnimationFrame(frames[i]);
    turns++;

    const from = angles[i];
    const start = performance.now();
    const duration = reduceMotion ? 1 : Math.max(300, 1000 * Math.abs(target - from) / 180);

    function step(now) {
      const t = Math.min((now - start) / duration, 1);
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      angles[i] = from + (target - from) * e;
      render();
      if (t < 1) frames[i] = requestAnimationFrame(step);
    }
    frames[i] = requestAnimationFrame(step);
  }

  // ---------- Buttons and label ----------
  function updateUI() {
    prevBtn.disabled = flipped === 0;
    nextBtn.disabled = flipped >= flippable;

    if (flipped === 0) {
      pageInfo.textContent = "Cover";
    } else {
      const left = flipped * 2;
      const right = left + 1;
      pageInfo.textContent = right > preview.total ? "Page " + left : "Pages " + left + "-" + right;
    }

    if (inView) loadUpTo(flipped * 2 + AHEAD); // download the next pages (only near the screen)
  }

  function next() {
    if (flipped < flippable) {
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

  // arrow keys only work while the Manuals section is on screen
  document.addEventListener("keydown", function (e) {
    if (!inView) return;
    if (e.key === "ArrowRight") next();
    if (e.key === "ArrowLeft") prev();
  });

  // ---------- Pull a page with the mouse or a finger ----------
  function attachDrag(leaf, i) {
    leaf.addEventListener("dragstart", function (e) { e.preventDefault(); });

    leaf.addEventListener("pointerdown", function (e) {
      // only the top page of each pile (and never the single last page)
      if (i >= flippable && i !== flipped - 1) return;
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
      if (dt > 0) drag.speed = (angle - drag.lastAngle) / dt; // degrees per millisecond
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

        if (speed > 0.1) target = 180;
        else if (speed < -0.1) target = 0;
        else target = angles[i] > 90 ? 180 : 0; // closest side
      }

      flipped = target === 180 ? i + 1 : i;
      animateTo(i, target);
      updateUI();
      drag = null;
    }

    leaf.addEventListener("pointerup", release);
    leaf.addEventListener("pointercancel", release);
  }

  // ---------- Hint on top of the book ----------
  // mouse: the label follows the cursor while it is over a page you can turn
  book.addEventListener("pointermove", function (e) {
    if (!tip) return;

    const leaf = e.target.closest(".mp-leaf");
    const show = leaf && !leaf.classList.contains("single") && !drag && turns < 4;

    tip.classList.toggle("show", Boolean(show));
    tip.style.transform = "translate(" + (e.clientX + 18) + "px, " + (e.clientY + 18) + "px)";
  });

  book.addEventListener("pointerleave", function () {
    if (tip) tip.classList.remove("show");
  });

  // touch: the swipe arrow goes away after the first touch
  book.addEventListener("pointerdown", function () {
    if (tip) tip.classList.remove("show");
    if (swipe) swipe.classList.add("gone");
  });

  // ---------- Only download pages when the section is near the screen ----------
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      inView = entries[0].isIntersecting;
      if (inView) loadUpTo(flipped * 2 + AHEAD);
    }, { rootMargin: "300px 0px" }).observe(section);
  } else {
    inView = true;
    loadUpTo(AHEAD);
  }

  window.addEventListener("resize", render);

  render();
  updateUI();
})();
