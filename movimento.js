const motion = matchMedia("(prefers-reduced-motion: no-preference)");

// Keep a visual copy of the old card above the new, interactive one.
function cardStack(card) {
  let departing;
  let settling;
  function clear() {
    departing?.remove();
    settling?.cancel();
    departing = null;
  }
  motion.addEventListener("change", clear);
  return function discard(direction) {
    clear();
    if (!motion.matches || !card.animate) return;
    const copy = card.cloneNode(true);
    copy.classList.add("card-departing");
    copy.inert = true;
    copy.setAttribute("aria-hidden", "true");
    for (const element of copy.querySelectorAll("[id]")) element.removeAttribute("id");
    copy.style.height = card.offsetHeight + "px";
    card.after(copy);
    departing = copy;
    const flight = copy.animate([
      { transform: "none", opacity: 1 },
      { transform: `translate(${direction * 21}%, -6%) rotate(${direction * 8}deg)`, opacity: 1, offset: .48 },
      { transform: `translate(${direction * 88}%, 13%) rotate(${direction * 23}deg)`, opacity: 0 }
    ], { duration: 540, easing: "cubic-bezier(.42,0,.6,1)", fill: "forwards" });
    flight.onfinish = () => {
      copy.remove();
      if (departing === copy) departing = null;
    };
    settling = card.animate([
      { transform: `scale(.955) rotate(${-direction * 2}deg)` },
      { transform: "none" }
    ], { duration: 560, easing: "cubic-bezier(.2,.7,.2,1)" });
  };
}

function initCover(gallery) {
  const card = gallery.querySelector(".cover");
  const photo = card.querySelector("img");
  const caption = card.querySelector("em");
  const link = card.querySelector("a");
  const controls = gallery.querySelector(".cover-controls");
  const play = controls.querySelector(".cover-play");
  const count = controls.querySelector(".cover-count");
  const slides = [];
  for (const work of document.querySelectorAll(".photos [data-service]")) {
    const thumb = work.querySelector("img");
    slides.push({ src: thumb.src, alt: thumb.alt, title: work.querySelector(".caption").firstChild.textContent.trim(), hash: "#" + work.dataset.service });
  }
  const discard = cardStack(card);
  let current = 0;
  let paused = !motion.matches;
  let visible = false;
  let hovered = false;
  let timer;

  function schedule() {
    clearTimeout(timer);
    play.textContent = paused ? "▶" : "Ⅱ";
    play.setAttribute("aria-label", paused ? "Iniciar troca automática" : "Pausar troca automática");
    if (!paused && visible && !hovered && !document.hidden) {
      timer = setTimeout(() => show(current + 1, 1), 1750);
    }
  }
  function show(index, direction) {
    index = (index + slides.length) % slides.length;
    if (index !== current) {
      if (visible) discard(direction);
      current = index;
    }
    const slide = slides[index];
    photo.src = slide.src;
    photo.alt = slide.alt;
    caption.textContent = slide.title;
    link.hash = slide.hash;
    count.textContent = String(index + 1).padStart(2, "0") + " / " + String(slides.length).padStart(2, "0");
    schedule();
  }
  controls.hidden = false;
  controls.querySelector(".cover-prev").onclick = () => show(current - 1, -1);
  controls.querySelector(".cover-next").onclick = () => show(current + 1, 1);
  play.onclick = () => { paused = !paused; schedule(); };
  gallery.addEventListener("focusin", event => {
    if (event.target !== play) { paused = true; schedule(); }
  });
  gallery.addEventListener("pointerenter", event => { hovered = event.pointerType === "mouse"; schedule(); });
  gallery.addEventListener("pointerleave", () => { hovered = false; schedule(); });
  motion.addEventListener("change", () => { paused = !motion.matches; schedule(); });
  document.addEventListener("visibilitychange", schedule);
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && entry.intersectionRatio >= .25;
      schedule();
    }, { threshold: .25 }).observe(gallery);
  } else {
    visible = true;
  }
  show(0, 1);
  return function syncCover(source) {
    const index = slides.findIndex(slide => source && slide.src === new URL(source, document.baseURI).href);
    if (index >= 0 && index !== current) show(index, index > current ? 1 : -1);
  };
}

function revealSections() {
  if (!("IntersectionObserver" in window)) return;
  const observer = new IntersectionObserver(entries => {
    for (const { target, isIntersecting } of entries) {
      if (!isIntersecting) continue;
      target.classList.add("arrived");
      observer.unobserve(target);
    }
  }, { threshold: 0.06 });
  const elements = document.querySelectorAll(
    ".album .wrap > .label, .album h2, .photos a, .list > *, #salao .two > div > *, " +
    "footer .two > div > *, .workgrid > div > *, .workgrid summary"
  );
  for (const element of elements) {
    element.classList.add("reveal");
    observer.observe(element);
  }
}

function initGuide(section, syncCover) {
  const stage = section.querySelector(".stage");
  const select = stage.querySelector("select");
  const items = Array.from(section.querySelectorAll("article"));
  const card = stage.querySelector(".service-card");
  const image = card.querySelector("img");
  const category = card.querySelector(".counter");
  const title = card.querySelector("h2");
  const description = card.querySelector("p");
  const contact = card.querySelector("a");
  const position = stage.querySelector(".position");
  const previous = stage.querySelector("#anterior");
  const next = stage.querySelector("#proximo");
  let current = -1;
  let step = 1;
  let scheduled = false;
  const discard = cardStack(card);

  const services = items.map((item, index) => {
    const group = item.querySelector("small").textContent;
    const name = item.querySelector("h3").textContent;
    if (select.lastElementChild?.label !== group) {
      const options = document.createElement("optgroup");
      options.label = group;
      select.append(options);
    }
    select.lastElementChild.append(new Option(name, index));
    return { group, name, image: item.querySelector(".list-photo").src, description: item.querySelector("p").textContent, url: item.querySelector("a").href };
  });

  function show(index) {
    if (current === index) return;
    const service = services[index];
    const last = current;
    if (last >= 0) {
      discard(index > last ? 1 : -1);
      syncCover?.(service.image);
    }
    current = index;
    category.textContent = service.group;
    title.textContent = service.name;
    description.textContent = service.description;
    contact.href = service.url;
    card.dataset.group = service.group;
    image.src = service.image;
    select.value = index;
    position.textContent = String(index + 1).padStart(2, "0") + " / " + services.length;
    previous.setAttribute("aria-disabled", String(index === 0));
    next.setAttribute("aria-disabled", String(index === services.length - 1));
  }

  function paint() {
    scheduled = false;
    if (!section.classList.contains("live")) return;
    const rect = section.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > innerHeight) return;
    const height = stage.offsetHeight;
    const focus = Math.max(0, Math.min(1, (innerHeight - rect.top) / height, rect.bottom / height));
    stage.style.setProperty("--blur", (focus * 16).toFixed(1) + "px");
    show(Math.max(0, Math.min(services.length - 1, Math.round(-rect.top / step))));
  }

  function go(index) {
    if (index < 0 || index >= services.length) return;
    const top = scrollY + section.getBoundingClientRect().top + index * step;
    window.scrollTo({ top: Math.ceil(top), behavior: "instant" });
    paint();
  }

  function followHash() {
    const index = items.findIndex(item => "#" + item.id === location.hash);
    if (index >= 0 && section.classList.contains("live")) go(index);
  }

  function resize() {
    const formerIndex = current;
    const top = section.getBoundingClientRect().top;
    const pinned = section.classList.contains("live") && top <= 1 && -top < section.offsetHeight - stage.offsetHeight;
    section.classList.toggle("live", motion.matches && innerHeight >= 510 && innerWidth >= 320);
    if (section.classList.contains("live")) {
      show(current < 0 ? 0 : current);
      if (stage.scrollHeight > stage.clientHeight + 1) section.classList.remove("live");
    }
    step = Math.max(200, Math.round(stage.offsetHeight * 0.52));
    section.style.height = section.classList.contains("live") ? stage.offsetHeight + step * (items.length - 0.5) + "px" : "";
    if (pinned && formerIndex >= 0) {
      if (section.classList.contains("live")) go(formerIndex);
      else items[formerIndex].scrollIntoView({ behavior: "instant" });
    }
    paint();
  }

  select.addEventListener("change", () => go(Number(select.value)));
  previous.addEventListener("click", () => go(current - 1));
  next.addEventListener("click", () => go(current + 1));
  window.addEventListener("scroll", () => {
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(paint);
    }
  }, { passive: true });
  window.addEventListener("resize", resize);
  window.addEventListener("hashchange", followHash);
  document.addEventListener("click", event => {
    const anchor = event.target.closest("a");
    if (anchor?.hash && anchor.href === location.href) requestAnimationFrame(followHash);
  });
  motion.addEventListener("change", resize);
  resize();
  followHash();
}

revealSections();
const guide = document.getElementById("servicos");
const gallery = document.querySelector(".cover-gallery");
const syncCover = gallery && initCover(gallery);
if (guide) initGuide(guide, syncCover);
