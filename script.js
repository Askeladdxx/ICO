// ----- 1. Hamburger menu -----
const menuBtn = document.getElementById("menuBtn");
const navLinks = document.getElementById("navLinks");
const links = document.querySelectorAll(".nav-links a");

menuBtn.addEventListener("click", function () {
  navLinks.classList.toggle("open");
});

links.forEach(function (link) {
  link.addEventListener("click", function () {
    navLinks.classList.remove("open"); // close the menu after clicking a link
  });
});

// ----- 2. Navbar gets a dark background after scrolling + highlights the current section -----
const navbar = document.getElementById("navbar");
const sections = document.querySelectorAll("header[id], section[id]");

// Looks at the section under the navbar and picks light or dark colors for it.
// Light section (white) -> light bar with dark text. Dark section -> dark bar with light text.
function updateNavTheme() {
  // at the very top the video check (section 10) decides the colors
  if (!navbar.classList.contains("scrolled")) return;

  // what is on the screen right behind the middle of the navbar?
  const stack = document.elementsFromPoint(window.innerWidth / 2, navbar.offsetHeight / 2);
  let under = null;

  for (const el of stack) {
    if (navbar.contains(el)) continue; // skip the navbar itself
    const found = el.closest("section, header, footer");
    if (found) {
      under = found;
      break;
    }
  }
  if (!under) return;

  // over the video: the dark bar with light text is always readable
  if (under.id === "home") {
    navbar.classList.remove("on-light");
    return;
  }

  // read the background color of that section: "rgb(250, 250, 250)"
  const rgb = getComputedStyle(under).backgroundColor.match(/\d+/g).map(Number);
  const brightness = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;

  navbar.classList.toggle("on-light", brightness > 0.5);
}

window.addEventListener("scroll", function () {
  navbar.classList.toggle("scrolled", window.scrollY > 60);
  updateNavTheme();

  let current = "home";
  sections.forEach(function (section) {
    if (window.scrollY >= section.offsetTop - 200) {
      current = section.id;
    }
  });

  links.forEach(function (link) {
    link.classList.toggle("active", link.getAttribute("href") === "#" + current);
  });
});

// ----- 3. Sections fade in when you scroll to them -----
const reveals = document.querySelectorAll(".reveal");

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add("show");
        observer.unobserve(entry.target); // only once
      }
    });
  }, { threshold: 0.15 });

  reveals.forEach(function (el) { observer.observe(el); });
} else {
  reveals.forEach(function (el) { el.classList.add("show"); });
}


// ----- 5. Credits: play / pause / restart the rolling credits -----
const creditsRoll = document.getElementById("creditsRoll");
const creditsPlay = document.getElementById("creditsPlay");
const creditsRestart = document.getElementById("creditsRestart");

// (only runs if the Credits section is on the page)
if (creditsRoll && creditsPlay && creditsRestart) {
  creditsPlay.addEventListener("click", function () {
    creditsRoll.classList.toggle("playing");
    creditsPlay.textContent = creditsRoll.classList.contains("playing") ? "Pause" : "Play";
  });

  creditsRestart.addEventListener("click", function () {
    creditsRoll.style.animation = "none";
    void creditsRoll.offsetWidth; // makes the browser forget the old animation
    creditsRoll.style.animation = "";
    creditsRoll.classList.add("playing");
    creditsPlay.textContent = "Pause";
  });
}

// ----- 6. Gallery: filter buttons -----
const galleryChips = document.querySelectorAll("#galleryChips .chip");
const tiles = document.querySelectorAll(".tile");

galleryChips.forEach(function (chip) {
  chip.addEventListener("click", function () {
    galleryChips.forEach(function (c) { c.classList.remove("active"); });
    chip.classList.add("active");

    tiles.forEach(function (tile) {
      const show = chip.dataset.filter === "all" || tile.dataset.type === chip.dataset.filter;
      tile.classList.toggle("out", !show);
    });
  });
});

// ----- 7. Gallery: click a picture to see it bigger -----
const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightboxImg");
const lightboxCap = document.getElementById("lightboxCap");

tiles.forEach(function (tile) {
  tile.addEventListener("click", function () {
    const img = tile.querySelector("img");
    lightboxImg.src = img.src;
    lightboxImg.alt = img.alt;
    lightboxCap.textContent = tile.querySelector("figcaption").textContent;
    lightbox.classList.remove("hidden");
  });
});

function closeLightbox() {
  lightbox.classList.add("hidden");
}

lightbox.addEventListener("click", closeLightbox);
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") closeLightbox();
});

// ----- 8. Hide pictures that fail to load (the colored box stays) -----
document.querySelectorAll("img").forEach(function (img) {
  if (!img.getAttribute("src")) return; // the picture viewer starts empty
  function markBroken() { img.classList.add("broken"); }
  img.addEventListener("error", markBroken);
  if (img.complete && img.naturalWidth === 0) markBroken();
});

// ----- 9. Background music (plays right away, the button mutes / unmutes) -----
const music = document.getElementById("music");
const soundBtn = document.getElementById("soundBtn");

music.volume = 0.5;

// icon only: speaker = sound is playing, crossed speaker = silent
function showSoundIcon() {
  const on = !music.paused && !music.muted;
  soundBtn.innerHTML = on ? "&#128266;" : "&#128263;";
  soundBtn.setAttribute("aria-label", on ? "Mute music" : "Play music");
}

// 1) try to play with sound as soon as the page opens
music.play().then(showSoundIcon).catch(function () {
  // 2) browsers block sound until the visitor does something on the page,
  //    so the music starts on the very first click, tap or key press
  showSoundIcon();

  const startEvents = ["pointerup", "touchend", "click", "keydown"];

  function stopWaiting() {
    startEvents.forEach(function (name) {
      document.removeEventListener(name, startOnFirstTouch);
    });
  }

  function startOnFirstTouch(e) {
    if (soundBtn.contains(e.target)) return; // the button has its own click
    if (!music.paused) { stopWaiting(); return; }
    music.play().then(function () {
      showSoundIcon();
      stopWaiting();
    }).catch(function () {});
  }

  startEvents.forEach(function (name) {
    document.addEventListener(name, startOnFirstTouch);
  });
});

soundBtn.addEventListener("click", function () {
  if (music.paused) {
    // the music was blocked, so the first press starts it
    music.muted = false;
    music.play().then(showSoundIcon).catch(function () {});
  } else {
    music.muted = !music.muted; // mute / unmute
    showSoundIcon();
  }
});

// ----- 10. Text color follows the video (dark text on a bright video) -----
const heroEl = document.getElementById("home");
const heroVideo = document.querySelector(".hero-video");
const heroText = document.querySelector(".hero-text");
const scrollCue = document.querySelector(".scroll-cue");

// small hidden canvas used to "look" at the video
const sampler = document.createElement("canvas");
sampler.width = 16;
sampler.height = 16;
const samplerCtx = sampler.getContext("2d", { willReadFrequently: true });

// what to watch:
//   box:   the element that sits on top of the video
//   apply: the element that gets the class
//   shade: how much the dark overlay already darkens that spot (0 to 1)
const watched = [
  { box: heroText,  apply: heroEl,   cls: "light-bg", shade: 0.35, history: [], on: false },
  { box: navbar,    apply: navbar,   cls: "on-light", shade: 0.2,  history: [], on: false },
  { box: scrollCue, apply: scrollCue, cls: "on-light", shade: 0.5, history: [], on: false }
];

const TURN_DARK_ABOVE = 0.55;   // brighter than this: switch to dark text
const TURN_LIGHT_BELOW = 0.45;  // darker than this: back to light text

// how bright (0 to 1) is the video right behind an element?
function brightnessBehind(el) {
  const vw = heroVideo.videoWidth;
  const vh = heroVideo.videoHeight;
  const box = heroVideo.getBoundingClientRect();
  const r = el.getBoundingClientRect();

  // the video fills the hero like a background (object-fit: cover), so find its real size
  const scale = Math.max(box.width / vw, box.height / vh);
  const offX = (box.width - vw * scale) / 2;
  const offY = (box.height - vh * scale) / 2;

  let sx = (r.left - box.left - offX) / scale;
  let sy = (r.top - box.top - offY) / scale;
  let sw = r.width / scale;
  let sh = r.height / scale;

  // keep the area inside the video
  sx = Math.max(0, sx);
  sy = Math.max(0, sy);
  sw = Math.min(sw, vw - sx);
  sh = Math.min(sh, vh - sy);
  if (sw <= 0 || sh <= 0) return null;

  samplerCtx.drawImage(heroVideo, sx, sy, sw, sh, 0, 0, 16, 16);
  const data = samplerCtx.getImageData(0, 0, 16, 16).data;

  let total = 0;
  for (let i = 0; i < data.length; i += 4) {
    total += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  }
  return total / (data.length / 4) / 255;
}

function updateTextColors() {
  // only while the video is playing and the top of the page is on screen
  if (heroVideo.readyState < 2 || document.hidden) return;
  if (window.scrollY > heroEl.offsetHeight) return;

  try {
    watched.forEach(function (item) {
      // the navbar gets its own dark background after scrolling
      if (item.box === navbar && navbar.classList.contains("scrolled")) {
        item.on = false;
        item.history = [];
        item.apply.classList.remove(item.cls);
        return;
      }

      const raw = brightnessBehind(item.box);
      if (raw === null) return;

      // brightness after the dark overlay, averaged over the last 4 checks (no flicker)
      item.history.push(raw * (1 - item.shade));
      if (item.history.length > 4) item.history.shift();
      const avg = item.history.reduce(function (a, b) { return a + b; }, 0) / item.history.length;

      if (!item.on && avg > TURN_DARK_ABOVE) item.on = true;
      if (item.on && avg < TURN_LIGHT_BELOW) item.on = false;

      item.apply.classList.toggle(item.cls, item.on);
    });
  } catch (error) {
    // the browser blocked reading the video (happens when opening the file directly)
    clearInterval(colorTimer);
    console.log("Auto text color is off:", error.name);
  }
}

const colorTimer = setInterval(updateTextColors, 500);

// ----- 11. Keep the background video playing -----
// Browsers sometimes pause a video (tab switch, power saving, scrolling away, a stall).
// This starts it again whenever the top of the page is on screen.
heroVideo.muted = true;          // muted videos are allowed to autoplay
heroVideo.defaultMuted = true;
heroVideo.playsInline = true;

let heroVisible = true;

function resumeVideo() {
  if (document.hidden || !heroVisible) return;
  if (heroVideo.paused || heroVideo.ended) {
    const attempt = heroVideo.play();
    if (attempt && attempt.catch) attempt.catch(function () {}); // blocked: wait for a tap
  }
}

// only fight a pause while the video is actually on screen
if ("IntersectionObserver" in window) {
  new IntersectionObserver(function (entries) {
    heroVisible = entries[0].isIntersecting;
    if (heroVisible) resumeVideo();
  }).observe(heroEl);
}

heroVideo.addEventListener("pause", function () { setTimeout(resumeVideo, 300); });
heroVideo.addEventListener("ended", resumeVideo);
document.addEventListener("visibilitychange", resumeVideo);   // came back to the tab
window.addEventListener("pageshow", resumeVideo);             // back/forward button
setInterval(resumeVideo, 3000);                               // safety check

// phones in Low Power Mode refuse autoplay until the first touch
["pointerup", "touchend", "click", "keydown"].forEach(function (name) {
  document.addEventListener(name, resumeVideo, { passive: true });
});

resumeVideo();
