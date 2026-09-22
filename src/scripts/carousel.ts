// The home-page carousel's behaviour, ported from
// ../klub_biolocation/themes/void/layouts/partials/home/carousel.html (MIGRATION-PLAN.md section 4).
// Imported by src/components/Carousel.astro, which src/pages/index.astro is the only user of.
//
// Moved here on 2026-09-22. It used to be a JavaScript template literal inside Carousel.astro,
// rendered with <script is:inline set:html={js} />, which meant three things: a backtick anywhere
// in the code or its comments ended the literal and made the compiler read the script as CSS or
// prose, nothing type-checked it, and it ran inline during parsing rather than as a module. What
// it gains here is the same thing site.ts gained: astro check reads it, and the annotations below
// write down contracts the original only implied.
//
// The logic is unchanged, deliberately - same sequence, same class names, same timings. What the
// rename forced is stated at each point: the null checks the querySelector calls always needed and
// never made, and the element types the DOM API asks for.
//
// Timing note. As an is:inline block this ran while the page was being parsed; as a module it is
// deferred and runs after the document is parsed. That is safe here, and checked: the markup in
// Carousel.astro declares the first slide's is-active class and the pause button's initial icon
// state itself, so the carousel is shown correctly before this file runs at all. It only starts
// the timer and binds the controls.

(function () {
  const root = document.getElementById("home-carousel");
  if (!root) return;

  const slides = root.querySelectorAll(".void-carousel__slide");
  const dots = root.querySelectorAll(".void-carousel__dot");
  const toggle = root.querySelector(".void-carousel__toggle");
  const iconPause = root.querySelector(".void-carousel__icon-pause");
  const iconPlay = root.querySelector(".void-carousel__icon-play");
  const n = slides.length;
  if (n < 2) {
    root.classList.add("is-single");
    return;
  }

  // The controls are rendered next to the slides in Carousel.astro, so they exist whenever there
  // are two or more slides. The check is here because querySelector says `Element | null` and this
  // file is type-checked now: a missing control would otherwise be a runtime error on the home
  // page, which is exactly the class of fault the .ts move is meant to catch. Leaving the
  // carousel static is the right answer if the markup ever changes - the photos still show.
  const nextBtn = root.querySelector(".void-carousel__btn--next");
  const prevBtn = root.querySelector(".void-carousel__btn--prev");
  if (!toggle || !iconPause || !iconPlay || !nextBtn || !prevBtn) return;

  // parseInt takes a string; getAttribute returns `string | null`. The `?? ""` makes the argument
  // a string and leaves the behaviour as it was: parseInt("") is NaN, and the `||` below then
  // falls back to 3000, the same value a missing attribute produced before.
  const interval =
    parseInt(root.getAttribute("data-interval") ?? "", 10) || 3000;
  let current = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  let paused = false;
  let hovered = false;

  function show(k: number) {
    k = (k + n) % n;
    if (k === current) return;
    slides[current].classList.remove("is-active");
    slides[current].setAttribute("aria-hidden", "true");
    dots[current].classList.remove("is-active");
    dots[current].setAttribute("aria-selected", "false");
    current = k;
    slides[current].classList.add("is-active");
    slides[current].removeAttribute("aria-hidden");
    dots[current].classList.add("is-active");
    dots[current].setAttribute("aria-selected", "true");
  }

  /* Hugo writes iconPause.hidden = paused here, which never worked: hidden is defined on
     HTMLElement and these icons are SVGElement, so the assignment set a plain JavaScript
     property and the pause button kept its icon forever. Measured in a headless browser -
     the attribute stayed absent and the computed display stayed block. The attribute itself
     is fine, which is why the markup can still declare the initial state with it; only the
     script had to change. Fixed on 2026-09-09 at the owner's request; see MIGRATION-PLAN.md
     section 9. The warning that used to end this comment - do not write a backtick here - went
     with the move to a .ts file on 2026-09-22; a backtick is an ordinary character now. */
  function setHidden(el: Element, hidden: boolean) {
    if (hidden) el.setAttribute("hidden", "");
    else el.removeAttribute("hidden");
  }

  function next() {
    show(current + 1);
  }

  function prev() {
    show(current - 1);
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function start() {
    stop();
    if (paused || hovered || document.hidden) return;
    timer = setInterval(next, interval);
  }

  nextBtn.addEventListener("click", function () {
    next();
    start();
  });
  prevBtn.addEventListener("click", function () {
    prev();
    start();
  });
  // `dot: Element` for the same reason as in site.ts: Array.prototype.forEach.call is how the
  // theme walks a NodeList, and `call` gives the callback no element type of its own.
  Array.prototype.forEach.call(dots, function (dot: Element) {
    dot.addEventListener("click", function () {
      show(parseInt(dot.getAttribute("data-index") ?? "", 10));
      start();
    });
  });
  toggle.addEventListener("click", function () {
    paused = !paused;
    toggle.setAttribute("aria-pressed", String(paused));
    toggle.setAttribute(
      "aria-label",
      paused ? "Resume autoplay" : "Pause autoplay",
    );
    setHidden(iconPause, paused);
    setHidden(iconPlay, !paused);
    start();
  });
  root.addEventListener("mouseenter", function () {
    hovered = true;
    stop();
  });
  root.addEventListener("mouseleave", function () {
    hovered = false;
    start();
  });
  root.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight") {
      next();
      start();
    } else if (e.key === "ArrowLeft") {
      prev();
      start();
    }
  });
  document.addEventListener("visibilitychange", start);

  let touchX: number | null = null;
  root.addEventListener(
    "touchstart",
    function (e) {
      touchX = e.touches[0].clientX;
    },
    {
      passive: true,
    },
  );
  root.addEventListener(
    "touchend",
    function (e) {
      if (touchX === null) return;
      const dx = e.changedTouches[0].clientX - touchX;
      touchX = null;
      if (Math.abs(dx) > 40) {
        if (dx < 0) {
          next();
        } else {
          prev();
        }
        start();
      }
    },
    {
      passive: true,
    },
  );

  start();
})();
