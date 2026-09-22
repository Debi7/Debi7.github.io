// The tag cloud turns like a globe. Added 2026-09-22 with the cloud itself
// (src/components/TagCloud.astro) and rewritten the same evening, when the owner named the
// reference: telo.by runs the WordPress plugin html5-cumulus, which is jQuery TagCanvas - a
// sphere of tags that spins, takes its speed from where the pointer is, and draws an outline box
// around the tag under the cursor. He asked for that behaviour without the box and without the
// colours, which is what this file does.
//
// WHY NOT TAGCANVAS ITSELF
//
// It needs jQuery and it paints into a canvas. The canvas is the part that matters: on the
// reference page every tag link sits in a list marked display:none beside it, so the picture a
// visitor sees carries no links at all, and the library has to reimplement hit testing, focus and
// the pointer cursor on top of a bitmap. Here the words stay anchors. The script moves them; it
// never draws them, so a crawler, a screen reader, a keyboard and the browser's own find-in-page
// all keep working, and the cloud is styled in CSS like the rest of the site.
//
// HOW IT WORKS
//
// The words are placed on a sphere once, by the spiral that spreads points evenly over one
// (phi from acos, theta from the golden-section step): an even spread matters because a naive
// latitude and longitude grid crowds the poles, which is where a cloud looks bald. Every frame
// the sphere is turned by two angles, each point is rotated and then projected onto the screen,
// and the word is moved with one transform, scaled and faded by how far away it now is. Nothing
// is measured during the loop except on resize, so a frame costs arithmetic and one style write
// per word.
//
// The speed follows the pointer the way the reference does: the further the pointer is from the
// middle of the block, the faster the sphere turns, and the direction is the direction of the
// pointer. With no pointer on it, it drifts slowly on its own instead of stopping, which is what
// makes the block read as alive rather than as broken.
//
// WHAT STAYS IN CSS
//
// The word under the pointer grows and the others fall back. That is a hover rule on the anchor,
// while this file transforms the span around it, so the two compose without either having to know
// about the other - see the note beside those rules in the component.
//
// WHEN IT DOES NOT RUN
//
// A visitor who asked for less motion never gets the sphere: the words stay in the wrapping row
// they are rendered as, which is also what a visitor without JavaScript sees. The row is the
// markup; the sphere is a class this script adds. Below 640px the block is display:none - the
// cloud and the home page's round menu links trade places there - so the loop is stopped while
// the media query says so, rather than turning a sphere nobody can see.
const cloud = document.querySelector<HTMLElement>(".tag-cloud");
const sky = cloud?.querySelector<HTMLElement>(".tag-cloud__sky");
const words = sky
  ? Array.from(sky.querySelectorAll<HTMLElement>(".tag-cloud__word"))
  : [];

// 640px is Tailwind's sm, which is where Header.astro swaps its menu for a hamburger and where
// this block appears. It is written out here because a script cannot read a Tailwind breakpoint;
// if that rule moves, this number moves with it.
const wideEnough = window.matchMedia("(min-width: 640px)");
const stillPlease = window.matchMedia("(prefers-reduced-motion: reduce)");

if (cloud && sky && words.length > 0) {
  /** A point on the unit sphere, and the numbers that make one word breathe. */
  type Placed = {
    node: HTMLElement;
    x: number;
    y: number;
    z: number;
    drift: number;
    breath: number;
    phase: number;
  };

  const number = (
    node: HTMLElement,
    name: string,
    fallback: number,
  ): number => {
    const raw = Number.parseFloat(node.dataset[name] ?? "");
    return Number.isFinite(raw) ? raw : fallback;
  };

  // The even spread. phi walks the sphere from pole to pole in equal steps of height, which is
  // what keeps the density constant (the surface of a sphere between two heights depends only on
  // the distance between them), and theta advances by an irrational fraction of a turn so that no
  // two rings ever line up into a seam.
  const placed: Placed[] = words.map((node, index) => {
    const phi = Math.acos(-1 + (2 * index + 1) / words.length);
    const theta = Math.sqrt(words.length * Math.PI) * phi;
    return {
      node,
      x: Math.cos(theta) * Math.sin(phi),
      y: Math.sin(theta) * Math.sin(phi),
      z: Math.cos(phi),
      drift: number(node, "drift", 4),
      breath: number(node, "breath", 8),
      phase: number(node, "phase", 0),
    };
  });

  // How far the sphere reaches, in pixels, and where its middle is. Measured on entry and on
  // resize only: reading it in the loop would force a layout every frame.
  let radius = 0;

  const measure = () => {
    const box = cloud.getBoundingClientRect();
    // A third of the shorter side. The words are wide and stand at the equator at their widest,
    // so a larger sphere pushes the longest of them past the edge of the block.
    radius = Math.min(box.width, box.height) * 0.36;
  };

  // The two angles of the sphere and the speed each is turning at. The idle speed is what the
  // cloud falls back to when the pointer is elsewhere: slow enough to read a word while it moves.
  let angleX = 0.35;
  let angleY = 0;
  let speedX = 0;
  let speedY = 0.0016;
  const idleY = 0.0016;
  const fastest = 0.02;

  let pointer: { x: number; y: number } | null = null;
  let frame = 0;
  let last = 0;

  const draw = (now: number) => {
    frame = requestAnimationFrame(draw);

    // Frame time, clamped: a tab that was in the background for a minute would otherwise come
    // back and spin the sphere through a hundred turns in one step. 16.7ms is one frame at 60Hz,
    // so the speeds above read as "per frame" on an ordinary screen and stay the same on a 120Hz
    // one.
    const step = Math.min(now - last, 50) / 16.7;
    last = now;

    if (pointer) {
      // The reference takes its speed from the pointer's distance to the middle, and so does
      // this: at the edge of the block the sphere turns fastest, in the middle it nearly stops.
      speedY += (pointer.x * fastest - speedY) * 0.08;
      speedX += (-pointer.y * fastest - speedX) * 0.08;
    } else {
      // Back to the idle drift, gently, so that letting go of the cloud does not stop it dead.
      speedY += (idleY - speedY) * 0.02;
      speedX += (0 - speedX) * 0.02;
    }

    angleY += speedY * step;
    angleX += speedX * step;

    const cosY = Math.cos(angleY);
    const sinY = Math.sin(angleY);
    const cosX = Math.cos(angleX);
    const sinX = Math.sin(angleX);
    const breathing = now / 1000;

    for (const word of placed) {
      // Around the vertical axis, then around the horizontal one.
      const x1 = word.x * cosY - word.z * sinY;
      const z1 = word.x * sinY + word.z * cosY;
      const y1 = word.y * cosX - z1 * sinX;
      const z2 = word.y * sinX + z1 * cosX;

      // The projection. 2 is the eye distance in sphere radii: the nearer half of the sphere
      // spreads out and the far half draws in, which is the depth cue that makes a flat block of
      // text read as a globe. A smaller number exaggerates it until the front words fly apart.
      const near = 2 / (2 - z2);
      const front = (z2 + 1) / 2;
      const bob =
        word.drift *
        Math.sin((breathing / word.breath) * Math.PI * 2 + word.phase);

      word.node.style.transform =
        "translate(-50%, -50%)" +
        ` translate3d(${(x1 * radius * near).toFixed(1)}px, ${(y1 * radius * near + bob).toFixed(1)}px, 0)` +
        // The floor was 0.62 until 2026-09-22, when the owner asked for the small words to be
        // easier to hit: a one-entry tag is the smallest step to begin with, and 0.62 of that on
        // the far side of the sphere was a target of a few pixels. 0.78 keeps the depth readable
        // and gives back about a quarter of the area. The same request raised the smallest font
        // step in the component.
        ` scale(${(0.78 + 0.34 * front).toFixed(3)})`;
      word.node.style.opacity = (0.45 + 0.55 * front).toFixed(3);
      // So that a word in front is also in front for the pointer, not only to the eye.
      word.node.style.zIndex = String(Math.round(front * 100));
    }
  };

  const start = () => {
    if (frame !== 0) return;
    cloud.classList.add("tag-cloud--sphere");
    measure();
    last = performance.now();
    frame = requestAnimationFrame(draw);
  };

  const stop = () => {
    if (frame !== 0) cancelAnimationFrame(frame);
    frame = 0;
    cloud.classList.remove("tag-cloud--sphere");
    // The row the words are rendered as has no use for what the loop wrote on them, and leaving
    // a transform behind would hold them wherever the last frame put them.
    for (const word of placed) {
      word.node.style.removeProperty("transform");
      word.node.style.removeProperty("opacity");
      word.node.style.removeProperty("z-index");
    }
  };

  const decide = () => {
    if (wideEnough.matches && !stillPlease.matches) start();
    else stop();
  };

  cloud.addEventListener("pointermove", (event: PointerEvent) => {
    const box = cloud.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return;
    // -1 at one edge of the block, +1 at the other.
    pointer = {
      x: ((event.clientX - box.left) / box.width - 0.5) * 2,
      y: ((event.clientY - box.top) / box.height - 0.5) * 2,
    };
  });

  const release = () => {
    pointer = null;
  };
  cloud.addEventListener("pointerleave", release);
  cloud.addEventListener("pointercancel", release);

  window.addEventListener("resize", () => {
    if (frame !== 0) measure();
  });

  wideEnough.addEventListener("change", decide);
  stillPlease.addEventListener("change", decide);
  decide();
}
