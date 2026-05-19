(() => {
  const catalog = globalThis.DRUM_PATTERN_CATALOG;
  const entries = catalog.entries;
  const groups = catalog.groups;
  const colors = { Kick: "var(--kick)", Snare: "var(--snare)", Hats: "var(--hats)", Toms: "var(--toms)", Perc: "var(--perc)" };
  const groupLabels = { Kick: "Kick", Snare: "Snare", Hats: "Hats", Toms: "Toms / Fills", Perc: "Perc / Foley" };
  const layoutNotes = {
    Bitwig: { kick: 36, kickB: 40, snare: 37, clap: 41, rimshot: 42, hatClosed: 38, hatOpen: 39, ride: 43, rideBell: 49, crash: 47, tomLow: 44, tomMid: 45, tomHigh: 46, tambourine: 50, cowbell: 51, shaker: 48 },
    Ableton: { kick: 36, kickB: 40, snare: 38, clap: 39, rimshot: 37, hatClosed: 42, hatOpen: 46, ride: 51, rideBell: 50, crash: 49, tomLow: 44, tomMid: 45, tomHigh: 47, tambourine: 48, cowbell: 52, shaker: 43 },
    GM: { kick: 36, kickB: 35, snare: 38, clap: 39, rimshot: 37, hatClosed: 42, hatOpen: 46, ride: 51, rideBell: 53, crash: 49, tomLow: 45, tomMid: 48, tomHigh: 50, tambourine: 54, cowbell: 56, shaker: 70 },
    Triaz: { kick: 36, kickB: 37, snare: 38, clap: 39, rimshot: 40, hatClosed: 42, hatOpen: 43, ride: 47, rideBell: 47, crash: 46, tomLow: 41, tomMid: 44, tomHigh: 45, tambourine: 44, cowbell: 37, shaker: 37 },
    XO: { kick: 36, kickB: 37, snare: 38, clap: 39, rimshot: 42, hatClosed: 40, hatOpen: 41, ride: 42, rideBell: 42, crash: 43, tomLow: 42, tomMid: 43, tomHigh: 43, tambourine: 42, cowbell: 42, shaker: 43 },
    AD2: { kick: 36, kickB: 65, snare: 38, clap: 44, rimshot: 37, hatClosed: 49, hatOpen: 54, ride: 60, rideBell: 61, crash: 77, tomLow: 67, tomMid: 69, tomHigh: 71, tambourine: 96, cowbell: 47, shaker: 101 },
  };
  const layoutConflictAlternates = {
    Triaz: {
      kickB: [35],
      ride: [51],
      rideBell: [49, 53],
      tomMid: [48],
      tambourine: [50, 54],
      cowbell: [51, 56],
      shaker: [48, 70],
    },
    XO: {
      rimshot: [39],
      ride: [43],
      rideBell: [43],
      crash: [42],
      tomLow: [43],
      tomMid: [42],
      tomHigh: [42],
      tambourine: [43],
      cowbell: [43],
      shaker: [42],
    },
  };
  const sampleSources = {
    kick: "samples/kick.wav",
    kickB: "samples/kick-b.wav",
    rimshot: "samples/rim.wav",
    clap: "samples/clap.wav",
    snare: "samples/snare.wav",
    hatClosed: "samples/hihat-closed.wav",
    hatOpen: "samples/hihat-open.wav",
    tambourine: "samples/tambourine.wav",
    cowbell: "samples/cowbell.wav",
    crash: "samples/crash.wav",
    shaker: "samples/shaker.wav",
    ride: "samples/ride.wav",
    rideBell: "samples/ride-bell.wav",
    tomHigh: "samples/tom-high.wav",
    tomMid: "samples/tom-mid.wav",
    tomLow: "samples/tom-low.wav",
  };
  const state = {
    group: "All",
    collection: "all",
    search: "",
    layout: "GM",
    combineSearch: "",
    combineCollection: "all",
    selected: Object.fromEntries(groups.map((group) => [group, null])),
    ctx: null,
    active: [],
    openHatGains: [],
    samples: {
      buffers: {},
      promise: null,
    },
    preview: {
      id: null,
      timer: null,
    },
    tempo: 112,
    activeView: "browse",
    transport: {
      isRunning: false,
      startTime: 0,
      scheduledUntilBeat: 0,
      playing: new Set(),
      timer: null,
      raf: null,
    },
  };
  const $ = (selector) => document.querySelector(selector);
  const els = {
    groupTabs: $("#groupTabs"),
    collectionTabs: $("#collectionTabs"),
    search: $("#searchInput"),
    layout: $("#layoutSelect"),
    groupTitle: $("#groupTitle"),
    groupSummary: $("#groupSummary"),
    grid: $("#patternGrid"),
    template: $("#patternCardTemplate"),
    browse: $("#browseView"),
    combine: $("#combineView"),
    rack: $("#selectedRack"),
    launcher: $("#launcher"),
    playCombo: $("#playComboBtn"),
    randomize: $("#randomizeComboBtn"),
    download: $("#downloadComboBtn"),
    combineSearch: $("#combineSearch"),
    combineCollection: $("#combineCollection"),
    tempoField: $("#tempoField"),
    tempoDown: $("#tempoDown"),
    tempoUp: $("#tempoUp"),
  };

  function init() {
    const allButton = document.createElement("button");
    allButton.textContent = "All";
    allButton.dataset.group = "All";
    allButton.addEventListener("click", () => { state.group = "All"; renderBrowse(); });
    els.groupTabs.append(allButton);

    groups.forEach((group) => {
      const button = document.createElement("button");
      button.textContent = groupLabel(group);
      button.dataset.group = group;
      button.addEventListener("click", () => { state.group = group; renderBrowse(); });
      els.groupTabs.append(button);
      state.selected[group] = entries.find((entry) => entry.group === group && entry.collection === "basics")?.id ?? null;
    });
    collectionOptions().forEach(({ value, label }) => {
      const button = document.createElement("button");
      button.textContent = label;
      button.dataset.collection = value;
      button.addEventListener("click", () => { state.collection = value; renderBrowse(); });
      els.collectionTabs.append(button);
    });
    catalog.collections.forEach((collection) => {
      els.combineCollection.add(new Option(title(collection), collection));
    });
    catalog.layouts.forEach((layout) => els.layout.add(new Option(layout, layout)));
    document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
    els.search.addEventListener("input", () => { state.search = els.search.value.trim().toLowerCase(); renderBrowse(); });
    els.layout.addEventListener("change", () => { state.layout = els.layout.value; renderBrowse(); });
    els.combineSearch.addEventListener("input", () => { state.combineSearch = els.combineSearch.value.trim().toLowerCase(); renderCombine(); });
    els.combineCollection.addEventListener("change", () => { state.combineCollection = els.combineCollection.value; renderCombine(); });
    els.playCombo.addEventListener("click", async () => {
      if (state.transport.isRunning) {
        stopTransport();
        return;
      }
      stopPreview();
      await preloadSamples(audioContext());
      groups.forEach((group) => {
        if (entryById(state.selected[group])) state.transport.playing.add(group);
      });
      if (state.transport.playing.size) startTransport();
      renderCombine();
    });
    els.randomize.addEventListener("click", randomizeCombine);
    els.download.addEventListener("click", downloadCombinedMidi);
    els.tempoField.value = state.tempo;
    els.tempoField.addEventListener("input", () => {
      const value = parseInt(els.tempoField.value, 10);
      if (!isNaN(value) && value >= 20 && value <= 400) setTempo(value);
      else els.tempoField.value = state.tempo;
      writeHash();
    });
    els.tempoDown.addEventListener("click", () => {
      setTempo(Math.max(20, state.tempo - 4));
      els.tempoField.value = state.tempo;
      writeHash();
    });
    els.tempoUp.addEventListener("click", () => {
      setTempo(Math.min(400, state.tempo + 4));
      els.tempoField.value = state.tempo;
      writeHash();
    });
    window.addEventListener("hashchange", applyHash);
    applyHash();
    renderBrowse();
    renderCombine();
  }

  function readHash() {
    const raw = location.hash.slice(1);
    const q = raw.indexOf("?");
    if (q < 0) return { view: raw || "browse", params: {} };
    const view = raw.slice(0, q);
    const params = {};
    raw.slice(q + 1).split("&").forEach((pair) => {
      const eq = pair.indexOf("=");
      if (eq >= 0) params[decodeURIComponent(pair.slice(0, eq))] = decodeURIComponent(pair.slice(eq + 1) || "");
    });
    return { view, params };
  }

  function writeHash() {
    const p = [];
    if (state.activeView === "browse") {
      if (state.group !== "All") p.push(`g=${encodeURIComponent(state.group)}`);
      if (state.collection !== "all") p.push(`c=${encodeURIComponent(state.collection)}`);
      if (state.search) p.push(`s=${encodeURIComponent(state.search)}`);
      if (state.layout !== "GM") p.push(`l=${encodeURIComponent(state.layout)}`);
    } else {
      groups.forEach((g) => {
        const id = state.selected[g];
        if (id) p.push(`${g[0]}=${encodeURIComponent(id)}`);
        else if (state.selected[g] === null) p.push(`${g[0]}=`);
      });
      if (state.tempo !== 112) p.push(`t=${state.tempo}`);
    }
    const raw = p.length ? `${state.activeView}?${p.join("&")}` : state.activeView;
    const url = `#${raw}`;
    if (location.hash !== url) history.replaceState(null, "", url);
  }

  function applyHash() {
    const { view, params } = readHash();
    state.activeView = view === "combine" ? "combine" : "browse";

    if (state.activeView === "browse") {
      if (params.g && (params.g === "All" || groups.includes(params.g))) state.group = params.g;
      if (params.c && catalog.collections.includes(params.c)) state.collection = params.c;
      if (params.s !== undefined) state.search = params.s;
      if (params.l && catalog.layouts.includes(params.l)) state.layout = params.l;
    } else {
      groups.forEach((g) => {
        if (params[g[0]] !== undefined) state.selected[g] = params[g[0]] || null;
      });
      if (params.t) { const t = parseInt(params.t, 10); if (t >= 20 && t <= 400) state.tempo = t; }
    }

    setView(state.activeView);
    els.search.value = state.search;
    els.layout.value = state.layout;
    els.combineSearch.value = state.combineSearch;
    els.combineCollection.value = state.combineCollection;
    els.tempoField.value = state.tempo;
  }

  function setView(view) {
    state.activeView = view;
    document.querySelectorAll("[data-view]").forEach((button) => button.classList.toggle("is-active", button.dataset.view === view));
    els.browse.classList.toggle("is-active", view === "browse");
    els.combine.classList.toggle("is-active", view === "combine");
    writeHash();
  }

  function renderBrowse() {
    els.groupTabs.querySelectorAll("button").forEach((button) => button.classList.toggle("is-active", button.dataset.group === state.group));
    els.collectionTabs.querySelectorAll("button").forEach((button) => button.classList.toggle("is-active", button.dataset.collection === state.collection));
    const all = state.group === "All" ? entries : entries.filter((entry) => entry.group === state.group);
    const visible = filterEntries(all, state.collection, state.search);
    els.groupTitle.textContent = `${state.group === "All" ? "All" : groupLabel(state.group)} Patterns`;
    els.groupSummary.textContent = `${visible.length} shown of ${all.length}`;
    els.grid.replaceChildren(...(visible.length ? visible.map(card) : [emptyState("No clips match the current filters.")]));
    writeHash();
  }

  function renderCombine() {
    const scrolls = Array.from(els.launcher.querySelectorAll(".lane-list"), (list) => list.scrollTop);
    els.rack.replaceChildren(...groups.map(selectedSlot));
    els.launcher.replaceChildren(...groups.map(launcherLane));
    els.launcher.querySelectorAll(".lane-list").forEach((list, index) => {
      if (scrolls[index] !== undefined) list.scrollTop = scrolls[index];
    });
    updateTransportButton();
    writeHash();
  }

  function filterEntries(source, collection, query) {
    return source.filter((entry) => {
      if (collection !== "all" && entry.collection !== collection) return false;
      if (!query) return true;
      return [entry.id, entry.name, entry.collection, entry.tier, ...entry.tags, ...entry.applicableGenres, ...entry.voices, ...entry.articulations, String(entry.energy), ...entry.usedSounds.map(soundLabel)]
        .filter(Boolean).join(" ").toLowerCase().includes(query);
    });
  }

  function collectionOptions() {
    return [
      { value: "all", label: "All" },
      ...catalog.collections.map((collection) => ({ value: collection, label: title(collection) })),
    ];
  }

  function combineEntriesFor(group) {
    return filterEntries(entries.filter((entry) => entry.group === group), state.combineCollection, state.combineSearch);
  }

  function randomizeCombine() {
    groups.forEach((group) => {
      const visible = combineEntriesFor(group);
      const entry = visible[Math.floor(Math.random() * visible.length)];
      state.selected[group] = entry?.id ?? null;
      if (state.transport.isRunning) {
        if (entry) state.transport.playing.add(group);
        else state.transport.playing.delete(group);
      }
    });
    if (state.transport.isRunning && state.transport.playing.size === 0) {
      stopTransport();
      return;
    }
    renderCombine();
  }

  function card(entry) {
    const node = els.template.content.firstElementChild.cloneNode(true);
    node.style.setProperty("--group-color", colors[entry.group]);
    node.querySelector(".id").textContent = `${entry.id} · ${title(entry.collection)}${entry.tier ? ` · ${title(entry.tier)}` : ""}`;
    node.querySelector("h3").textContent = entry.name;
    node.querySelector(".meta").replaceChildren(
      chip(`${entry.bars} bar${entry.bars === 1 ? "" : "s"}`),
      chip(`density ${entry.density}`),
      ...(entry.applicableGenres ?? []).map((genre) => chip(genre, "genre"))
    );
    node.querySelector(".mini-roll").append(roll(entry));
    const playButton = node.querySelector(".play");
    playButton.dataset.entryId = entry.id;
    updatePreviewButton(playButton, state.preview.id === entry.id);
    playButton.addEventListener("click", () => togglePreview(entry));
    const select = node.querySelector(".select");
    select.textContent = "Use in Mix";
    select.addEventListener("click", () => {
      state.selected[entry.group] = entry.id;
      renderCombine();
      setView("combine");
    });
    const downloadBtn = node.querySelector(".download");
    downloadBtn.addEventListener("click", () => downloadSingleMidi(entry));
    return node;
  }

  function roll(entry) {
    const wrap = document.createElement("div");
    wrap.className = "roll-body";
    const totalSteps = 64;
    const sourceSteps = Math.max(1, Math.round(entry.lengthBeats * 4));
    const repeats = Math.max(1, Math.floor(totalSteps / sourceSteps));
    for (const sound of entry.usedSounds.length ? entry.usedSounds : ["unknown"]) {
      const row = document.createElement("div");
      row.className = "roll-row";
      const label = document.createElement("div");
      label.className = "roll-label";
      label.textContent = soundLabel(sound);
      const steps = document.createElement("div");
      steps.className = "steps";
      for (let repeat = 0; repeat < repeats; repeat += 1) {
        entry.hits.filter((hit) => hit.sound === sound).forEach((hit) => {
          const step = Math.round(hit.time * 4) + repeat * sourceSteps;
          if (step >= totalSteps) return;
          const dot = document.createElement("span");
          dot.className = "hit";
          dot.style.gridColumn = `${step + 1} / span ${Math.max(1, Math.round((hit.duration || 0.1) * 4))}`;
          dot.style.setProperty("--vel", String(Math.max(0.12, (hit.velocity / 127) ** 1.4)));
          steps.append(dot);
        });
      }
      const playhead = document.createElement("span");
      playhead.className = "playhead";
      steps.append(playhead);
      row.append(label, steps);
      wrap.append(row);
    }
    return wrap;
  }

  function selectedSlot(group) {
    const entry = entryById(state.selected[group]);
    const isPlaying = state.transport.playing.has(group);
    const slot = document.createElement("div");
    slot.className = "selected-slot";
    slot.classList.toggle("is-playing", isPlaying);
    slot.dataset.group = group;
    slot.style.setProperty("--group-color", colors[group]);

    const info = document.createElement("div");
    info.className = "slot-info";
    const label = document.createElement("strong");
    label.textContent = groupLabel(group);
    const id = document.createElement("div");
    id.className = "id";
    id.textContent = entry ? `${entry.id} ${entry.name}` : "Silence";
    id.title = id.textContent;
    info.append(label, id);

    const rollEl = entry ? roll(entry) : document.createElement("div");
    rollEl.className = rollEl.className || "";
    if (!entry) rollEl.classList.add("empty-roll");

    slot.append(info, rollEl);
    return slot;
  }

  function launcherLane(group) {
    const lane = document.createElement("section");
    lane.className = "launcher-lane";
    lane.style.setProperty("--group-color", colors[group]);
    const head = document.createElement("div");
    head.className = "lane-head";
    const visible = combineEntriesFor(group);
    head.textContent = `${groupLabel(group)} (${visible.length})`;
    const list = document.createElement("div");
    list.className = "lane-list";

    const noneBtn = document.createElement("button");
    noneBtn.className = "launcher-clip launcher-none";
    noneBtn.classList.toggle("is-selected", state.selected[group] === null);
    noneBtn.innerHTML = `<strong>&mdash; None &mdash;</strong><small>Silence &mdash; no pattern for this group</small>`;
    noneBtn.addEventListener("click", () => {
      state.selected[group] = null;
      state.transport.playing.delete(group);
      if (state.transport.isRunning && state.transport.playing.size === 0) {
        stopTransport();
        return;
      }
      renderCombine();
    });
    list.append(noneBtn);

    if (!visible.length) {
      list.append(emptyState("No matching clips."));
    }
    visible.forEach((entry) => {
      const button = document.createElement("button");
      button.className = "launcher-clip";
      button.classList.toggle("is-selected", state.selected[group] === entry.id);
      button.innerHTML = `<strong>${entry.id} ${escapeHtml(entry.name)}</strong><small>${title(entry.collection)} · ${entry.bars} bar${entry.bars === 1 ? "" : "s"} · ${entry.usedSounds.map(soundLabel).join(" + ")}</small>`;
      button.addEventListener("click", () => {
        state.selected[group] = entry.id;
        if (state.transport.isRunning) state.transport.playing.add(group);
        renderCombine();
      });
      list.append(button);
    });
    lane.append(head, list);
    return lane;
  }

  function startTransport() {
    if (state.transport.isRunning) return;
    const ctx = audioContext();
    state.transport.isRunning = true;
    state.transport.startTime = ctx.currentTime + 0.05;
    state.transport.scheduledUntilBeat = 0;
    state.transport.timer = setInterval(transportTick, 25);
    state.transport.raf = requestAnimationFrame(updatePlayheads);
    updateTransportButton();
    transportTick();
  }

  function stopTransport() {
    state.transport.isRunning = false;
    state.transport.playing.clear();
    if (state.transport.timer) {
      clearInterval(state.transport.timer);
      state.transport.timer = null;
    }
    if (state.transport.raf) {
      cancelAnimationFrame(state.transport.raf);
      state.transport.raf = null;
    }
    clearPlayheads();
    stopAudio();
    updateTransportButton();
    renderCombine();
  }

  function updateTransportButton() {
    const label = els.playCombo.querySelector(".transport-label");
    if (label) label.textContent = state.transport.isRunning ? "Stop" : "Play Mix";
    els.playCombo.classList.toggle("is-stopping", state.transport.isRunning);
    els.playCombo.setAttribute("aria-pressed", state.transport.isRunning ? "true" : "false");
    els.playCombo.setAttribute("aria-label", state.transport.isRunning ? "Stop playback" : "Play mix");
  }

  function setTempo(tempo) {
    if (tempo === state.tempo) return;
    const ctx = state.ctx;
    const currentBeat = ctx && state.transport.isRunning ? Math.max(0, transportBeatAt(ctx.currentTime)) : 0;
    state.tempo = tempo;
    if (ctx && state.transport.isRunning) {
      stopAudio();
      state.transport.startTime = ctx.currentTime - currentBeat * beatDuration();
      state.transport.scheduledUntilBeat = currentBeat;
    }
  }

  function beatDuration() {
    return 60 / state.tempo;
  }

  function transportBeatAt(time) {
    return (time - state.transport.startTime) / beatDuration();
  }

  function transportTick() {
    if (!state.transport.isRunning) return;
    const ctx = audioContext();
    const now = ctx.currentTime;
    const lookahead = 0.2;
    const windowStartBeat = state.transport.scheduledUntilBeat;
    const windowEndBeat = Math.max(windowStartBeat, transportBeatAt(now + lookahead));
    const beatDur = beatDuration();
    const epsilon = 0.000001;

    groups.forEach((group) => {
      if (!state.transport.playing.has(group)) return;
      const entry = entryById(state.selected[group]);
      if (!entry || entry.lengthBeats <= 0) return;

      const firstCycle = Math.floor(windowStartBeat / entry.lengthBeats);
      const lastCycle = Math.floor(windowEndBeat / entry.lengthBeats);
      for (let cycle = firstCycle; cycle <= lastCycle; cycle += 1) {
        entry.hits.forEach((hit) => {
          const hitBeat = cycle * entry.lengthBeats + hit.time;
          if (hitBeat < windowStartBeat - epsilon || hitBeat >= windowEndBeat - epsilon) return;
          const hitTime = state.transport.startTime + hitBeat * beatDur;
          if (hitTime >= now - 0.01) drum(ctx, hit.sound, hitTime, hit.velocity / 127);
        });
      }
    });

    state.transport.scheduledUntilBeat = windowEndBeat;
  }

  function updatePlayheads() {
    if (!state.transport.isRunning) return;
    const ctx = audioContext();
    const displayBeat = ((transportBeatAt(ctx.currentTime) % 16) + 16) % 16;
    const percent = `${(displayBeat / 16) * 100}%`;
    groups.forEach((group) => {
      const slot = els.rack.querySelector(`.selected-slot[data-group="${group}"]`);
      if (!slot) return;
      slot.classList.toggle("is-playing", state.transport.playing.has(group));
      slot.querySelectorAll(".steps").forEach((steps) => steps.style.setProperty("--playhead-left", percent));
    });
    state.transport.raf = requestAnimationFrame(updatePlayheads);
  }

  function clearPlayheads() {
    els.rack.querySelectorAll(".selected-slot").forEach((slot) => slot.classList.remove("is-playing"));
    els.rack.querySelectorAll(".steps").forEach((steps) => steps.style.removeProperty("--playhead-left"));
  }

  async function togglePreview(entry) {
    if (state.preview.id === entry.id) {
      stopPreview();
      return;
    }
    await playEntry(entry);
  }

  async function playEntry(entry) {
    if (state.transport.isRunning) stopTransport();
    const ctx = audioContext();
    await preloadSamples(ctx);
    stopAudio();
    stopPreviewTimer();
    state.preview.id = entry.id;
    refreshPreviewButtons();
    schedule([entry], 16);
    state.preview.timer = setTimeout(stopPreview, Math.ceil(16 * beatDuration() * 1000) + 100);
  }

  function stopPreview() {
    stopPreviewTimer();
    state.preview.id = null;
    stopAudio();
    refreshPreviewButtons();
  }

  function stopPreviewTimer() {
    if (!state.preview.timer) return;
    clearTimeout(state.preview.timer);
    state.preview.timer = null;
  }

  function refreshPreviewButtons() {
    document.querySelectorAll(".preview-toggle").forEach((button) => {
      const isPlaying = button.dataset.entryId === state.preview.id;
      updatePreviewButton(button, isPlaying);
    });
  }

  function updatePreviewButton(button, isPlaying) {
    button.classList.toggle("is-stopping", isPlaying);
    button.setAttribute("aria-pressed", isPlaying ? "true" : "false");
    button.setAttribute("aria-label", isPlaying ? "Stop preview" : "Play preview");
    button.title = isPlaying ? "Stop preview" : "Play preview";
  }

  function schedule(toPlay, totalBeats) {
    if (!toPlay.length) return;
    const ctx = audioContext();
    const start = ctx.currentTime + 0.04;
    const beat = 60 / state.tempo;
    toPlay.forEach((entry) => {
      const repeats = Math.max(1, Math.ceil(totalBeats / entry.lengthBeats));
      for (let repeat = 0; repeat < repeats; repeat += 1) {
        entry.hits.forEach((hit) => {
          const time = hit.time + repeat * entry.lengthBeats;
          if (time < totalBeats) drum(ctx, hit.sound, start + time * beat, hit.velocity / 127);
        });
      }
    });
  }

  function audioContext() {
    state.ctx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (state.ctx.state === "suspended") state.ctx.resume();
    return state.ctx;
  }

  async function preloadSamples(ctx) {
    if (state.samples.promise) return state.samples.promise;
    state.samples.promise = Promise.all(Object.entries(sampleSources).map(async ([sound, url]) => {
      try {
        const response = await fetch(url);
        if (!response.ok) return;
        state.samples.buffers[sound] = await ctx.decodeAudioData(await response.arrayBuffer());
      } catch {
        state.samples.buffers[sound] = null;
      }
    }));
    return state.samples.promise;
  }

  function stopAudio() {
    state.active.forEach((node) => {
      try { node.stop(); } catch {}
      try { node.disconnect(); } catch {}
    });
    state.active = [];
    state.openHatGains = [];
  }

  function drum(ctx, sound, time, velocity) {
    const out = ctx.createGain();
    out.gain.value = Math.max(0.08, velocity) * 0.55;
    out.connect(ctx.destination);
    if (sound.includes("kick")) return kick(ctx, out, time, sound === "kickB");
    if (sound === "snare") return snare(ctx, out, time);
    if (sound === "clap") return clap(ctx, out, time);
    if (sound === "rimshot") return rimshot(ctx, out, time);
    if (sound.startsWith("tom")) return tom(ctx, out, time, sound);
    if (sound === "hatClosed") return hatClosed(ctx, out, time);
    if (sound === "hatOpen") return hatOpen(ctx, out, time);
    if (sound === "ride") return ride(ctx, out, time);
    if (sound === "rideBell") return rideBell(ctx, out, time);
    if (sound === "crash") return crash(ctx, out, time);
    if (sound === "tambourine") return tambourine(ctx, out, time);
    if (sound === "cowbell") return cowbell(ctx, out, time);
    if (sound === "shaker") return shaker(ctx, out, time);
    noise(ctx, out, time, 0.08, 6500);
  }

  function snare(ctx, out, time) {
    const sampled = playSample(ctx, "snare", out, time, 0.82, 1);
    const level = sampled ? 0.28 : 1;
    const snareOut = ctx.createGain();
    snareOut.gain.value = level;
    snareOut.connect(out);
    noise(ctx, snareOut, time, 0.105, 1450);
    tone(ctx, out, time, 180, 135, 0.045, "triangle", level);
  }

  function kick(ctx, out, time, alternate) {
    out.gain.value *= 1.15;
    const sampled = playSample(ctx, alternate ? "kickB" : "kick", out, time, alternate ? 0.92 : 0.86, 1);
    const level = sampled ? 0.35 : 1;
    const body = alternate ? 39 : 46;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(body * 1.45, time);
    osc.frequency.exponentialRampToValueAtTime(body, time + 0.085);
    osc.frequency.exponentialRampToValueAtTime(body * 0.82, time + 0.24);
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(level, time + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.48, time + 0.045);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.32);
    osc.connect(gain).connect(out);
    osc.start(time);
    osc.stop(time + 0.34);
    state.active.push(osc);
    if (!sampled) kickTransient(ctx, out, time);
  }

  function kickTransient(ctx, out, time) {
    const source = whiteNoise(ctx, 0.018);
    const lp = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    lp.type = "lowpass";
    lp.frequency.value = 720;
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(0.22, time + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.025);
    source.connect(lp).connect(gain).connect(out);
    source.start(time);
    source.stop(time + 0.025);
    state.active.push(source);
  }

  function clap(ctx, out, time) {
    const sampled = playSample(ctx, "clap", out, time, 0.82, 1);
    const level = sampled ? 0.35 : 1;
    clapBurst(ctx, out, time, 0.034, 1200, 6800, 0.48 * level);
    clapBurst(ctx, out, time + 0.032, 0.04, 1100, 6200, 0.62 * level);
    clapBurst(ctx, out, time + 0.072, 0.075, 1000, 5600, 0.4 * level);
  }

  function clapBurst(ctx, out, time, dur, highpass, lowpass, level) {
    const source = whiteNoise(ctx, dur);
    const hp = ctx.createBiquadFilter();
    const lp = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    hp.type = "highpass";
    hp.frequency.value = highpass;
    hp.Q.value = 0.35;
    lp.type = "lowpass";
    lp.frequency.value = lowpass;
    lp.Q.value = 0.25;
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(level, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    source.connect(hp).connect(lp).connect(gain).connect(out);
    source.start(time);
    source.stop(time + dur);
    state.active.push(source);
  }

  function rimshot(ctx, out, time) {
    const sampled = playSample(ctx, "rimshot", out, time, 0.95, 1.08);
    const rimOut = ctx.createGain();
    rimOut.gain.value = sampled ? 0.22 : 0.72;
    rimOut.connect(out);
    noise(ctx, rimOut, time, 0.032, 3200);
    tone(ctx, rimOut, time, 1050, 760, 0.024, "triangle");
  }

  function tom(ctx, out, time, sound) {
    const sampled = playSample(ctx, sound, out, time, 0.55, 1);
    const level = sampled ? 0.25 : 1;
    const pitch = sound === "tomHigh" ? 185 : sound === "tomMid" ? 138 : 100;
    tomTone(ctx, out, time, pitch, pitch * 0.48, 0.36, "sine", 1 * level);
    tomTone(ctx, out, time, pitch * 0.52, pitch * 0.38, 0.3, "triangle", 0.65 * level);
    if (!sampled) tomTransient(ctx, out, time);
  }

  function tomTone(ctx, out, time, startFreq, endFreq, dur, type, level) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, time);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), time + dur);
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(level, time + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc.connect(gain).connect(out);
    osc.start(time);
    osc.stop(time + dur);
    state.active.push(osc);
  }

  function tomTransient(ctx, out, time) {
    const source = whiteNoise(ctx, 0.026);
    const lp = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    lp.type = "lowpass";
    lp.frequency.value = 920;
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(0.16, time + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.026);
    source.connect(lp).connect(gain).connect(out);
    source.start(time);
    source.stop(time + 0.026);
    state.active.push(source);
  }

  function hatClosed(ctx, out, time) {
    chokeOpenHats(ctx, time);
    if (!playSample(ctx, "hatClosed", out, time, 0.82, 1)) {
      metallicNoise(ctx, out, time, 0.045, 7600, 11200);
    }
  }

  function hatOpen(ctx, out, time) {
    chokeOpenHats(ctx, time);
    const sampled = playSampleSource(ctx, "hatOpen", out, time, 0.76, 1);
    if (sampled) {
      state.openHatGains.push(sampled.gain);
      return;
    }
    const hatGain = ctx.createGain();
    hatGain.gain.setValueAtTime(1, time);
    hatGain.gain.exponentialRampToValueAtTime(0.001, time + 0.72);
    hatGain.connect(out);
    metallicNoise(ctx, hatGain, time, 0.76, 6200, 10500);
    state.active.push(hatGain);
    state.openHatGains.push(hatGain);
  }

  function chokeOpenHats(ctx, time) {
    state.openHatGains = state.openHatGains.filter((gain) => {
      try {
        gain.gain.cancelScheduledValues(time);
        gain.gain.setValueAtTime(Math.max(0.001, gain.gain.value || 0.001), time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.085);
        return true;
      } catch {
        return false;
      }
    });
  }

  function cymbal(ctx, out, time, dur, highpass) {
    metallicNoise(ctx, out, time, dur, highpass, 9500);
  }

  function crash(ctx, out, time) {
    const sampled = playSample(ctx, "crash", out, time, 0.32, 1);
    if (!sampled) return cymbal(ctx, out, time, 0.9, 3200);
    metallicNoise(ctx, out, time, 0.28, 5200, 10000);
  }

  function ride(ctx, out, time) {
    const sampled = playSample(ctx, "ride", out, time, 0.72, 1);
    if (!sampled) return cymbal(ctx, out, time, 0.42, 4200);
  }

  function rideBell(ctx, out, time) {
    const sampled = playSample(ctx, "rideBell", out, time, 0.48, 1.22);
    if (sampled) return;
    metallicNoise(ctx, out, time, 0.22, 5200, 11500);
    tone(ctx, out, time, 1180, 980, 0.18, "triangle");
  }

  function tambourine(ctx, out, time) {
    const sampled = playSample(ctx, "tambourine", out, time, 0.7, 1.08);
    const level = sampled ? 0.22 : 1;
    jingle(ctx, out, time, 0.038, 8500, 0.46 * level);
    jingle(ctx, out, time + 0.018, 0.044, 9800, 0.34 * level);
    jingle(ctx, out, time + 0.044, 0.062, 7600, 0.28 * level);
  }

  function cowbell(ctx, out, time) {
    const sampled = playSample(ctx, "cowbell", out, time, 0.88, 1);
    const level = sampled ? 0.28 : 1;
    tone(ctx, out, time, 860, 820, 0.18, "triangle", 0.7 * level);
    tone(ctx, out, time, 1320, 1260, 0.14, "square", 0.26 * level);
  }

  function playSample(ctx, sound, out, time, level, playbackRate = 1) {
    return Boolean(playSampleSource(ctx, sound, out, time, level, playbackRate));
  }

  function playSampleSource(ctx, sound, out, time, level, playbackRate = 1) {
    const buffer = state.samples.buffers[sound];
    if (!buffer) return null;
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = buffer;
    source.playbackRate.value = playbackRate;
    gain.gain.setValueAtTime(level, time);
    source.connect(gain).connect(out);
    source.start(time);
    source.stop(time + buffer.duration / playbackRate);
    state.active.push(source);
    return { source, gain };
  }

  function jingle(ctx, out, time, dur, band, level) {
    const source = whiteNoise(ctx, dur);
    const hp = ctx.createBiquadFilter();
    const bp = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    hp.type = "highpass";
    hp.frequency.value = 6200;
    bp.type = "bandpass";
    bp.frequency.value = band;
    bp.Q.value = 0.75;
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(level, time + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    source.connect(hp).connect(bp).connect(gain).connect(out);
    source.start(time);
    source.stop(time + dur);
    state.active.push(source);
  }

  function shaker(ctx, out, time) {
    const sampled = playSample(ctx, "shaker", out, time, 0.85, 1.08);
    const level = sampled ? 0.22 : 1;
    const shakerOut = ctx.createGain();
    shakerOut.gain.value = level;
    shakerOut.connect(out);
    noise(ctx, shakerOut, time, 0.065, 7800);
    noise(ctx, shakerOut, time + 0.025, 0.045, 9000);
  }

  function tone(ctx, out, time, startFreq, endFreq, dur, type, level = 1) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, time);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), time + dur);
    gain.gain.setValueAtTime(level, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc.connect(gain).connect(out);
    osc.start(time);
    osc.stop(time + dur);
    state.active.push(osc);
  }

  function metallicNoise(ctx, out, time, dur, highpass, lowpass) {
    const source = whiteNoise(ctx, dur);
    const hp = ctx.createBiquadFilter();
    const lp = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    hp.type = "highpass";
    hp.frequency.value = highpass;
    lp.type = "lowpass";
    lp.frequency.value = lowpass;
    gain.gain.setValueAtTime(1, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    source.connect(hp).connect(lp).connect(gain).connect(out);
    source.start(time);
    source.stop(time + dur);
    state.active.push(source);
  }

  function noise(ctx, out, time, dur, highpass) {
    const source = whiteNoise(ctx, dur);
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    filter.type = "highpass";
    filter.frequency.value = highpass;
    gain.gain.setValueAtTime(1, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    source.connect(filter).connect(gain).connect(out);
    source.start(time);
    source.stop(time + dur);
    state.active.push(source);
  }

  function whiteNoise(ctx, dur) {
    const buffer = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * dur)), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    return source;
  }

  function downloadSingleMidi(entry) {
    const bytes = buildMidi([entry], 16, state.layout);
    const url = URL.createObjectURL(new Blob([bytes], { type: "audio/midi" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${state.layout}-${entry.id}-${entry.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}.mid`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function downloadCombinedMidi() {
    const selected = groups.map((group) => entryById(state.selected[group])).filter(Boolean);
    if (!selected.length) return;
    const bytes = buildMidi(selected, 16, state.layout);
    const url = URL.createObjectURL(new Blob([bytes], { type: "audio/midi" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${state.layout}-combined-${selected.map((entry) => entry.id).join("-")}.mid`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function buildMidi(selected, totalBeats, layoutName = "GM") {
    const ppq = 480;
    const events = [];
    const notes = layoutNotes[layoutName] ?? layoutNotes.GM;
    const occupiedByTick = new Map();
    selected.forEach((entry) => {
      const repeats = Math.max(1, Math.ceil(totalBeats / entry.lengthBeats));
      for (let repeat = 0; repeat < repeats; repeat += 1) {
        entry.hits.forEach((hit) => {
          const time = hit.time + repeat * entry.lengthBeats;
          if (time >= totalBeats) return;
          const tick = Math.round(time * ppq);
          const occupiedAtTick = occupiedByTick.get(tick) ?? new Map();
          const note = resolveLayoutNote(hit.sound, layoutName, notes, occupiedAtTick, hit.note);
          occupiedAtTick.set(note, hit.sound);
          occupiedByTick.set(tick, occupiedAtTick);
          const dur = Math.max(24, Math.round((hit.duration || 0.1) * ppq));
          events.push({ tick, bytes: [0x99, note, hit.velocity] }, { tick: tick + dur, bytes: [0x89, note, 0] });
        });
      }
    });
    const coalesced = coalesceMidiEvents(events);
    coalesced.sort((a, b) => a.tick - b.tick);
    const track = [...meta("Combined Drum Pattern")];
    let last = 0;
    coalesced.forEach((event) => {
      track.push(...varLen(event.tick - last), ...event.bytes);
      last = event.tick;
    });
    track.push(...varLen(totalBeats * ppq - last), 0xff, 0x2f, 0);
    return new Uint8Array([...ascii("MThd"), 0, 0, 0, 6, 0, 0, 0, 1, ppq >> 8, ppq & 255, ...ascii("MTrk"), ...u32(track.length), ...track]);
  }

  function resolveLayoutNote(sound, layoutName, notes, occupiedAtTick, fallbackNote) {
    const preferred = notes[sound] ?? fallbackNote;
    const occupiedSound = occupiedAtTick.get(preferred);
    if (!occupiedSound || occupiedSound === sound) return preferred;
    for (const alternate of layoutConflictAlternates[layoutName]?.[sound] ?? []) {
      if (!occupiedAtTick.has(alternate)) return alternate;
    }
    return preferred;
  }

  function coalesceMidiEvents(events) {
    const hits = new Map();
    events.forEach((event) => {
      const status = event.bytes[0] & 0xf0;
      if (status !== 0x90 || event.bytes[2] <= 0) return;
      const off = events.find((candidate) =>
        candidate.tick >= event.tick &&
        (candidate.bytes[0] & 0xf0) === 0x80 &&
        candidate.bytes[1] === event.bytes[1]
      );
      const key = `${event.tick}:${event.bytes[1]}`;
      const existing = hits.get(key);
      const duration = off ? off.tick - event.tick : 24;
      if (!existing || event.bytes[2] > existing.velocity || duration > existing.duration) {
        hits.set(key, { tick: event.tick, note: event.bytes[1], velocity: Math.max(event.bytes[2], existing?.velocity ?? 0), duration: Math.max(duration, existing?.duration ?? 0) });
      }
    });
    return [...hits.values()].flatMap((hit) => [
      { tick: hit.tick, bytes: [0x99, hit.note, hit.velocity] },
      { tick: hit.tick + hit.duration, bytes: [0x89, hit.note, 0] },
    ]);
  }

  function meta(text) {
    const bytes = ascii(text);
    return [0, 0xff, 0x03, bytes.length, ...bytes, 0, 0xff, 0x01, bytes.length, ...bytes];
  }
  function varLen(value) {
    let buffer = value & 0x7f;
    const bytes = [];
    while ((value >>= 7)) buffer = (buffer << 8) | ((value & 0x7f) | 0x80);
    while (true) {
      bytes.push(buffer & 0xff);
      if (buffer & 0x80) buffer >>= 8;
      else break;
    }
    return bytes;
  }
  const u32 = (value) => [(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255];
  const ascii = (text) => Array.from(text, (char) => char.charCodeAt(0) & 127);
  const entryById = (id) => entries.find((entry) => entry.id === id);
  const soundLabel = (sound) => catalog.soundLabels[sound] ?? sound;
  const groupLabel = (group) => groupLabels[group] ?? group;
  const title = (value) => String(value ?? "").replace(/[-_]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
  const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[char]));
  function chip(text, variant) {
    const span = document.createElement("span");
    span.className = variant ? `chip chip-${variant}` : "chip";
    span.textContent = text;
    return span;
  }
  function emptyState(text) {
    const div = document.createElement("div");
    div.className = "empty-state";
    div.textContent = text;
    return div;
  }

  init();
})();
