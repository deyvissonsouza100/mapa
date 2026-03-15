(() => {
  const APP_CONFIG = window.APP_CONFIG || {};
  const MAP_CONFIG = APP_CONFIG.map || {};
  const STORAGE_KEY =
    (APP_CONFIG.storage && APP_CONFIG.storage.localKey) || "gcm_bh_vtrs_supabase";

  let map;
  let mapReady = false;
  let markers = new Map();
  let selectedId = null;
  let placingMode = false;
  let currentData = [];
  let supabaseClient = null;
  let useSupabase = false;
  let pdfDetectedItems = [];
  let localPlaces = [];

  const els = {};

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    cacheElements();
    bindEvents();
    initMap();
    initSupabase();
    await loadLocalPlaces();
    initPdfImport();
    await loadData();
    renderAll();
    updateModeBadge();
    setNowInfo();

    setInterval(() => {
      renderAll();
      setNowInfo();
    }, 30000);
  }

  function cacheElements() {
    els.modeBadge = document.getElementById("modeBadge");
    els.mapStatus = document.getElementById("mapStatus");
    els.todayInfo = document.getElementById("todayInfo");
    els.prefix = document.getElementById("prefix");
    els.team = document.getElementById("team");
    els.lat = document.getElementById("lat");
    els.lng = document.getElementById("lng");
    els.startAt = document.getElementById("startAt");
    els.endAt = document.getElementById("endAt");
    els.addressQuery = document.getElementById("addressQuery");
    els.btnSearchAddress = document.getElementById("btnSearchAddress");
    els.addressResults = document.getElementById("addressResults");
    els.btnSetOnMap = document.getElementById("btnSetOnMap");
    els.btnUseCenter = document.getElementById("btnUseCenter");
    els.btnSave = document.getElementById("btnSave");
    els.btnClearForm = document.getElementById("btnClearForm");
    els.btnRefresh = document.getElementById("btnRefresh");
    els.btnDelete = document.getElementById("btnDelete");
    els.search = document.getElementById("search");
    els.list = document.getElementById("vtrList");
    els.count = document.getElementById("vtrCount");
    els.formTitle = document.getElementById("formTitle");
    els.helpText = document.getElementById("helpText");
    els.pdfFile = document.getElementById("pdfFile");
    els.btnReadPdf = document.getElementById("btnReadPdf");
    els.btnSaveValidPdf = document.getElementById("btnSaveValidPdf");
    els.pdfDetectedCount = document.getElementById("pdfDetectedCount");
    els.pdfPreview = document.getElementById("pdfPreview");
  }

  function bindEvents() {
    els.btnSetOnMap?.addEventListener("click", () => {
      placingMode = true;
      updateHelp("Clique no mapa para posicionar a VTR.");
    });

    els.btnUseCenter?.addEventListener("click", () => {
      if (!mapReady) {
        updateHelp("Mapa ainda não está pronto.");
        return;
      }
      const center = map.getCenter();
      els.lat.value = round6(center.lat);
      els.lng.value = round6(center.lng);
      updateHelp("Coordenadas preenchidas com o centro atual do mapa.");
    });

    els.btnSearchAddress?.addEventListener("click", searchAddress);
    els.addressQuery?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        searchAddress();
      }
    });

    els.btnSave?.addEventListener("click", saveCurrentVTR);
    els.btnClearForm?.addEventListener("click", clearForm);
    els.btnRefresh?.addEventListener("click", async () => {
      await loadData();
      renderAll();
      updateHelp("Lista atualizada.");
    });
    els.btnDelete?.addEventListener("click", deleteSelectedVTR);
    els.search?.addEventListener("input", renderListOnly);
  }

  function initPdfImport() {
    els.btnReadPdf?.addEventListener("click", parsePdfImport);
    els.btnSaveValidPdf?.addEventListener("click", saveDetectedPdfItems);
  }

  function initMap() {
    const style =
      MAP_CONFIG.style ||
      MAP_CONFIG.styleUrl ||
      "https://demotiles.maplibre.org/style.json";

    map = new maplibregl.Map({
      container: "map",
      style,
      center: MAP_CONFIG.center || [-43.9386, -19.9208],
      zoom: MAP_CONFIG.zoom ?? 12,
      minZoom: MAP_CONFIG.minZoom ?? 11,
      maxZoom: MAP_CONFIG.maxZoom ?? 19,
      pitch: MAP_CONFIG.pitch ?? 0,
      bearing: MAP_CONFIG.bearing ?? 0,
      maxBounds: MAP_CONFIG.maxBounds || undefined,
      attributionControl: true
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on("load", () => {
      mapReady = true;
      map.resize();
      setMapStatus("Mapa carregado.");
    });

    map.on("error", (e) => {
      console.error("Erro no mapa:", e);
      setMapStatus("Erro ao carregar o mapa.");
    });

    map.on("click", (e) => {
      if (!placingMode) return;
      els.lat.value = round6(e.lngLat.lat);
      els.lng.value = round6(e.lngLat.lng);
      placingMode = false;
      updateHelp("Ponto definido no mapa. Agora clique em Salvar VTR.");
    });

    window.addEventListener("load", () => {
      setTimeout(() => {
        if (map) map.resize();
      }, 300);
    });
  }

  function initSupabase() {
    const cfg = APP_CONFIG.supabase || {};
    const hasUrl = cfg.url && !cfg.url.includes("COLE_AQUI");
    const hasKey = cfg.anonKey && !cfg.anonKey.includes("COLE_AQUI");

    if (!hasUrl || !hasKey) {
      useSupabase = false;
      updateModeBadge();
      return;
    }

    if (!window.supabase || !window.supabase.createClient) {
      console.warn("Biblioteca do Supabase não carregada. Usando modo local.");
      useSupabase = false;
      updateModeBadge();
      return;
    }

    try {
      supabaseClient = window.supabase.createClient(cfg.url, cfg.anonKey);
      useSupabase = true;
      updateModeBadge();
    } catch (err) {
      console.error("Falha ao iniciar Supabase:", err);
      useSupabase = false;
      updateModeBadge();
    }
  }

  async function loadLocalPlaces() {
    if (useSupabase) {
      try {
        const { data, error } = await supabaseClient
          .from("locais_operacionais_bh")
          .select("*");
        if (error) throw error;
        localPlaces = data || [];
        return;
      } catch (err) {
        console.warn("Sem locais_operacionais_bh online.", err);
      }
    }
    localPlaces = [];
  }

  async function loadData() {
    if (useSupabase) {
      try {
        const { data, error } = await supabaseClient
          .from("viaturas")
          .select("*")
          .order("updated_at", { ascending: false });

        if (error) throw error;
        currentData = (data || []).map(normalizeRow);
        return;
      } catch (err) {
        console.error("Erro carregando Supabase:", err);
        updateHelp("Falha no banco online. Entrando em modo local.");
        useSupabase = false;
        updateModeBadge();
      }
    }
    currentData = loadLocal();
  }

  function loadLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.map(normalizeRow) : [];
    } catch (err) {
      console.error("Erro no localStorage:", err);
      return [];
    }
  }

  function saveLocal() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentData));
  }

  async function saveCurrentVTR() {
    const payload = readForm();
    if (!payload) return;

    try {
      if (useSupabase) {
        if (selectedId) {
          const { error } = await supabaseClient
            .from("viaturas")
            .update({
              prefix: payload.prefix,
              team: payload.team,
              latitude: payload.latitude,
              longitude: payload.longitude,
              start_at: payload.start_at,
              end_at: payload.end_at,
              address_label: payload.address_label,
              updated_at: new Date().toISOString()
            })
            .eq("id", selectedId);
          if (error) throw error;
        } else {
          const { error } = await supabaseClient
            .from("viaturas")
            .insert({
              prefix: payload.prefix,
              team: payload.team,
              latitude: payload.latitude,
              longitude: payload.longitude,
              start_at: payload.start_at,
              end_at: payload.end_at,
              address_label: payload.address_label
            });
          if (error) throw error;
        }
        await loadData();
      } else {
        if (selectedId) {
          currentData = currentData.map((item) =>
            item.id === selectedId
              ? { ...item, ...payload, updated_at: new Date().toISOString() }
              : item
          );
        } else {
          currentData.unshift({
            id: cryptoRandomId(),
            ...payload,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        }
        saveLocal();
      }

      renderAll();
      updateHelp(selectedId ? "VTR atualizada com sucesso." : "VTR salva com sucesso.");
      clearForm(false);
    } catch (err) {
      console.error("Erro ao salvar:", err);
      updateHelp("Erro ao salvar a VTR.");
    }
  }

  async function deleteSelectedVTR() {
    if (!selectedId) {
      updateHelp("Selecione uma VTR para excluir.");
      return;
    }

    const confirmed = window.confirm("Deseja excluir a VTR selecionada?");
    if (!confirmed) return;

    try {
      if (useSupabase) {
        const { error } = await supabaseClient
          .from("viaturas")
          .delete()
          .eq("id", selectedId);
        if (error) throw error;
        await loadData();
      } else {
        currentData = currentData.filter((item) => item.id !== selectedId);
        saveLocal();
      }

      removeMarker(selectedId);
      selectedId = null;
      renderAll();
      clearForm(false);
      updateHelp("VTR excluída.");
    } catch (err) {
      console.error("Erro ao excluir:", err);
      updateHelp("Erro ao excluir a VTR.");
    }
  }

  async function searchAddress() {
    const query = (els.addressQuery?.value || "").trim();
    if (!query) {
      updateHelp("Digite um endereço para buscar.");
      return;
    }

    if (!els.addressResults) return;
    els.addressResults.innerHTML = `<div class="address-loading">Buscando endereço...</div>`;

    try {
      const finalQuery = `${query}, Belo Horizonte, MG, Brasil`;
      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.searchParams.set("q", finalQuery);
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("limit", "5");
      url.searchParams.set("countrycodes", "br");

      const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error("Falha na busca de endereço.");

      const data = await res.json();
      renderAddressResults(data || []);
    } catch (err) {
      console.error("Erro na busca de endereço:", err);
      els.addressResults.innerHTML = `<div class="empty-state">Não foi possível buscar o endereço.</div>`;
      updateHelp("Erro ao buscar endereço.");
    }
  }

  function renderAddressResults(results) {
    if (!els.addressResults) return;

    if (!results.length) {
      els.addressResults.innerHTML = `<div class="empty-state">Nenhum endereço encontrado.</div>`;
      return;
    }

    els.addressResults.innerHTML = "";

    results.forEach((item) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "address-result";
      btn.innerHTML = `
        <strong>${escapeHtml(item.display_name)}</strong>
        <small>Lat: ${round6(item.lat)} · Lng: ${round6(item.lon)}</small>
      `;

      btn.addEventListener("click", () => {
        const lat = Number(item.lat);
        const lng = Number(item.lon);
        els.lat.value = round6(lat);
        els.lng.value = round6(lng);

        if (mapReady) {
          map.flyTo({ center: [lng, lat], zoom: 17, speed: 0.9 });
        }

        if (els.addressQuery) els.addressQuery.value = item.display_name;
        updateHelp("Endereço selecionado.");
      });

      els.addressResults.appendChild(btn);
    });
  }

  async function parsePdfImport() {
    const file = els.pdfFile?.files?.[0];
    if (!file) {
      updateHelp("Selecione um PDF primeiro.");
      return;
    }

    try {
      if (els.pdfPreview) els.pdfPreview.innerHTML = `<div class="address-loading">Lendo PDF...</div>`;
      if (els.pdfDetectedCount) els.pdfDetectedCount.textContent = "Lendo PDF...";

      const text = await readPdfFile(file);
      console.log("TEXTO PDF EXTRAÍDO:", text);

      pdfDetectedItems = extractVtrsFromPdfText(text);
      await enrichDetectedItemsWithKnownPlaces(pdfDetectedItems);
      renderPdfPreview(pdfDetectedItems);

      if (els.pdfDetectedCount) {
        els.pdfDetectedCount.textContent = `${pdfDetectedItems.length} item(ns) detectado(s).`;
      }

      updateHelp(
        pdfDetectedItems.length
          ? `${pdfDetectedItems.length} item(ns) detectado(s) no PDF.`
          : "Nenhuma VTR detectada no PDF."
      );
    } catch (err) {
      console.error("Erro ao ler PDF:", err);
      if (els.pdfPreview) els.pdfPreview.innerHTML = `<div class="empty-state">Erro ao ler o PDF.</div>`;
      if (els.pdfDetectedCount) els.pdfDetectedCount.textContent = "Nenhum item detectado.";
      updateHelp("Erro ao ler o PDF.");
    }
  }

  async function readPdfFile(file) {
    const arrayBuffer = await file.arrayBuffer();
    if (!window.pdfjsLib) throw new Error("PDF.js não carregou.");

    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.js";

    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item) => item.str).join(" ");
      fullText += "\n" + pageText;
    }

    return fullText.replace(/\s+/g, " ").trim();
  }

  function extractVtrsFromPdfText(text) {
    const results = [];
    const normalized = text.replace(/\s+/g, " ").trim();

    const dateMatches = [...normalized.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g)];
    const multiDayMatch = normalized.match(/\b(\d{1,2})\s*e\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\b/i);

    const timeMatch =
      normalized.match(/(\d{1,2})h(?:\s*:\s*(\d{2}))?\s*(?:às|as|-|a)\s*(\d{1,2})h(?:\s*:\s*(\d{2}))?/i) ||
      normalized.match(/(\d{1,2})[:h](\d{2})?\s*(?:às|as|-|a)\s*(\d{1,2})[:h](\d{2})?/i);

    const startHour = timeMatch
      ? `${String(timeMatch[1]).padStart(2, "0")}:${String(timeMatch[2] || "00").padStart(2, "0")}`
      : "07:00";

    const endHour = timeMatch
      ? `${String(timeMatch[3]).padStart(2, "0")}:${String(timeMatch[4] || "00").padStart(2, "0")}`
      : "17:00";

    const detectedDays = [];

    if (multiDayMatch) {
      const d1 = String(multiDayMatch[1]).padStart(2, "0");
      const d2 = String(multiDayMatch[2]).padStart(2, "0");
      const mm = String(multiDayMatch[3]).padStart(2, "0");
      const yyyy = multiDayMatch[4];
      detectedDays.push(`${yyyy}-${mm}-${d1}`);
      detectedDays.push(`${yyyy}-${mm}-${d2}`);
    } else if (dateMatches.length) {
      for (const m of dateMatches) {
        const dd = String(m[1]).padStart(2, "0");
        const mm = String(m[2]).padStart(2, "0");
        const yyyy = m[3];
        detectedDays.push(`${yyyy}-${mm}-${dd}`);
      }
    }

    const uniqueDays = [...new Set(detectedDays)];
    const placePatterns = [
      "Casa do Baile",
      "Praça Dalva Simão",
      "Praça Dino Barbieri",
      "Praça Geralda da Mata Pimentel",
      "Praça Expedicionário Lourival Pereira",
      "Marco Zero",
      "Parque Ecológico Promotor José Lins do Rêgo",
      "Zoológico",
      "Museu de Arte da Pampulha",
      "MAP",
      "Mineirão",
      "Mineirinho",
      "Praça Sete",
      "Mercado Central",
      "Rodoviária",
      "Lagoa da Pampulha"
    ];

    const foundPlaces = [];
    for (const place of placePatterns) {
      if (normalized.toLowerCase().includes(place.toLowerCase())) {
        foundPlaces.push(place);
      }
    }

    const uniquePlaces = [...new Set(foundPlaces)];
    if (!uniquePlaces.length) return [];

    if (!uniqueDays.length) {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, "0");
      const dd = String(today.getDate()).padStart(2, "0");
      uniqueDays.push(`${yyyy}-${mm}-${dd}`);
    }

    for (const day of uniqueDays) {
      for (const place of uniquePlaces) {
        results.push({
          id: cryptoRandomId(),
          prefix: place,
          team: detectTeamFromText(normalized),
          address_label: place,
          latitude: null,
          longitude: null,
          start_at: `${day}T${startHour}:00`,
          end_at: `${day}T${endHour}:00`,
          detected_from_pdf: true,
          pending_location: true
        });
      }
    }

    return results;
  }

  async function enrichDetectedItemsWithKnownPlaces(items) {
    for (const item of items) {
      const known = findKnownPlace(item.address_label);
      if (known) {
        item.latitude = Number(known.latitude);
        item.longitude = Number(known.longitude);
        item.pending_location = false;
        continue;
      }

      try {
        const geo = await geocodeSingle(item.address_label);
        if (geo) {
          item.latitude = geo.latitude;
          item.longitude = geo.longitude;
          item.pending_location = false;
        }
      } catch (err) {
        console.warn("Sem geocodificação automática para", item.address_label, err);
      }
    }
  }

  function findKnownPlace(label) {
    const q = String(label || "").toLowerCase();
    return localPlaces.find((p) => {
      const name = String(p.nome_local || "").toLowerCase();
      const aliases = String(p.aliases || "").toLowerCase();
      return q.includes(name) || name.includes(q) || aliases.includes(q);
    }) || null;
  }

  async function geocodeSingle(label) {
    const finalQuery = `${label}, Belo Horizonte, MG, Brasil`;
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", finalQuery);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");
    url.searchParams.set("countrycodes", "br");

    const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.length) return null;

    return {
      latitude: Number(data[0].lat),
      longitude: Number(data[0].lon)
    };
  }

  function detectTeamFromText(text) {
    const lower = text.toLowerCase();
    if (lower.includes("regional pampulha")) return "Regional Pampulha";
    if (lower.includes("regional norte")) return "Regional Norte";
    if (lower.includes("regional venda nova")) return "Regional Venda Nova";
    if (lower.includes("grb")) return "GRB";
    return "A definir";
  }

  function renderPdfPreview(items) {
    if (!els.pdfPreview) return;

    if (!items.length) {
      els.pdfPreview.innerHTML = `<div class="empty-state">Nenhuma VTR detectada no PDF.</div>`;
      return;
    }

    els.pdfPreview.innerHTML = "";

    items.forEach((item, index) => {
      const div = document.createElement("div");
      div.className = "vtr-item";
      div.innerHTML = `
        <strong>${escapeHtml(item.prefix || "Sem prefixo")}</strong>
        <span>${escapeHtml(item.team || "Sem equipe")}</span>
        <small>${formatDateTime(item.start_at)} até ${formatDateTime(item.end_at)}</small>
        <small>${escapeHtml(item.address_label || "Local pendente")}</small>
        <small>${item.pending_location ? "Pendente de posição no mapa" : "Pronto para salvar"}</small>
        <div style="margin-top:8px; display:flex; gap:8px;">
          <button type="button" class="btn btn-secondary" data-pdf-use="${index}">Usar no formulário</button>
        </div>
      `;
      els.pdfPreview.appendChild(div);
    });

    els.pdfPreview.querySelectorAll("[data-pdf-use]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.getAttribute("data-pdf-use"));
        useDetectedPdfItem(idx);
      });
    });
  }

  function useDetectedPdfItem(index) {
    const item = pdfDetectedItems[index];
    if (!item) return;

    selectedId = null;
    if (els.formTitle) els.formTitle.textContent = `Novo item do PDF`;
    if (els.prefix) els.prefix.value = item.prefix || "";
    if (els.team) els.team.value = item.team || "";
    if (els.addressQuery) els.addressQuery.value = item.address_label || "";
    if (els.startAt) els.startAt.value = toDatetimeLocalValue(item.start_at);
    if (els.endAt) els.endAt.value = toDatetimeLocalValue(item.end_at);

    if (item.latitude && item.longitude) {
      if (els.lat) els.lat.value = round6(item.latitude);
      if (els.lng) els.lng.value = round6(item.longitude);
      if (mapReady) map.flyTo({ center: [item.longitude, item.latitude], zoom: 17, speed: 0.9 });
    } else {
      if (els.lat) els.lat.value = "";
      if (els.lng) els.lng.value = "";
    }

    updateHelp("Item do PDF carregado no formulário. Agora confira a posição e salve.");
  }

  async function saveDetectedPdfItems() {
    if (!pdfDetectedItems.length) {
      updateHelp("Nenhum item detectado para salvar.");
      return;
    }

    const validItems = pdfDetectedItems.filter((item) => item.latitude && item.longitude);
    if (!validItems.length) {
      updateHelp("Nenhum item válido com coordenadas para salvar. Use no formulário e posicione no mapa.");
      return;
    }

    try {
      if (useSupabase) {
        const payload = validItems.map((item) => ({
          prefix: item.prefix,
          team: item.team,
          latitude: item.latitude,
          longitude: item.longitude,
          address_label: item.address_label,
          start_at: item.start_at,
          end_at: item.end_at
        }));

        const { error } = await supabaseClient.from("viaturas").insert(payload);
        if (error) throw error;
        await loadData();
      } else {
        const payload = validItems.map((item) => ({
          id: cryptoRandomId(),
          prefix: item.prefix,
          team: item.team,
          latitude: item.latitude,
          longitude: item.longitude,
          address_label: item.address_label,
          start_at: item.start_at,
          end_at: item.end_at,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));
        currentData.unshift(...payload);
        saveLocal();
      }

      renderAll();
      updateHelp(`${validItems.length} item(ns) do PDF salvo(s).`);
    } catch (err) {
      console.error("Erro ao salvar itens do PDF:", err);
      updateHelp("Erro ao salvar os itens válidos do PDF.");
    }
  }

  function readForm() {
    const prefix = (els.prefix?.value || "").trim();
    const team = (els.team?.value || "").trim();
    const latitude = parseFloat(String(els.lat?.value || "").replace(",", "."));
    const longitude = parseFloat(String(els.lng?.value || "").replace(",", "."));
    const addressLabel = (els.addressQuery?.value || "").trim();

    if (!prefix) {
      updateHelp("Informe o prefixo da VTR.");
      els.prefix?.focus();
      return null;
    }

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      updateHelp("Informe latitude e longitude válidas.");
      return null;
    }

    const now = new Date();
    let startAt = parseDatetimeLocal(els.startAt?.value);
    let endAt = parseDatetimeLocal(els.endAt?.value);

    if (!startAt && !endAt) {
      startAt = now;
      endAt = endOfDay(now);
    } else if (startAt && !endAt) {
      endAt = endOfDay(startAt);
    } else if (!startAt && endAt) {
      startAt = now;
    }

    if (startAt > endAt) {
      updateHelp("A data/hora final não pode ser menor que a inicial.");
      return null;
    }

    return {
      prefix,
      team,
      latitude,
      longitude,
      start_at: startAt.toISOString(),
      end_at: endAt.toISOString(),
      address_label: addressLabel
    };
  }

  function clearForm(showMessage = true) {
    selectedId = null;
    placingMode = false;

    if (els.formTitle) els.formTitle.textContent = "Nova / editar VTR";
    if (els.prefix) els.prefix.value = "";
    if (els.team) els.team.value = "";
    if (els.lat) els.lat.value = "";
    if (els.lng) els.lng.value = "";
    if (els.startAt) els.startAt.value = "";
    if (els.endAt) els.endAt.value = "";
    if (els.addressQuery) els.addressQuery.value = "";
    if (els.addressResults) els.addressResults.innerHTML = "";

    renderListOnly();
    if (showMessage) updateHelp("Formulário limpo.");
  }

  function fillForm(item) {
    selectedId = item.id;

    if (els.formTitle) els.formTitle.textContent = `Editando ${item.prefix}`;
    if (els.prefix) els.prefix.value = item.prefix || "";
    if (els.team) els.team.value = item.team || "";
    if (els.lat) els.lat.value = round6(item.latitude);
    if (els.lng) els.lng.value = round6(item.longitude);
    if (els.startAt) els.startAt.value = toDatetimeLocalValue(item.start_at);
    if (els.endAt) els.endAt.value = toDatetimeLocalValue(item.end_at);
    if (els.addressQuery) els.addressQuery.value = item.address_label || "";

    renderListOnly();
    updateHelp(`VTR ${item.prefix} selecionada.`);
  }

  function renderAll() {
    renderListOnly();
    renderMarkers();
    fitIfNeeded();
    setNowInfo();
  }

  function isActiveNow(item) {
    const now = new Date();
    const start = item.start_at ? new Date(item.start_at) : null;
    const end = item.end_at ? new Date(item.end_at) : null;
    if (!start || !end) return false;
    return start <= now && now <= end;
  }

  function getVisibleData() {
    return currentData.filter(isActiveNow);
  }

  function renderListOnly() {
    if (!els.list) return;

    const q = (els.search?.value || "").trim().toLowerCase();
    const filtered = currentData.filter((item) => {
      const hay = `${item.prefix} ${item.team} ${item.address_label || ""}`.toLowerCase();
      return !q || hay.includes(q);
    });

    els.list.innerHTML = "";
    if (els.count) els.count.textContent = String(filtered.length);

    if (!filtered.length) {
      els.list.innerHTML = `<div class="empty-state">Nenhuma VTR cadastrada.</div>`;
      return;
    }

    filtered.forEach((item) => {
      const active = isActiveNow(item);
      const div = document.createElement("button");
      div.type = "button";
      div.className = `vtr-item${item.id === selectedId ? " active" : ""}`;
      div.innerHTML = `
        <strong>${escapeHtml(item.prefix || "Sem prefixo")}</strong>
        <span>${escapeHtml(item.team || "Sem equipe")}</span>
        <small>${formatDateTime(item.start_at)} até ${formatDateTime(item.end_at)}</small>
        <small>${active ? "Ativa agora" : "Fora do horário atual"}</small>
      `;
      div.addEventListener("click", () => {
        fillForm(item);
        flyToVTR(item);
      });
      els.list.appendChild(div);
    });
  }

  function renderMarkers() {
    if (!mapReady) return;

    const visibleData = getVisibleData();
    const idsInData = new Set(visibleData.map((item) => item.id));

    for (const [id] of markers) {
      if (!idsInData.has(id)) removeMarker(id);
    }

    visibleData.forEach((item) => upsertMarker(item));
  }

  function upsertMarker(item) {
    if (!mapReady) return;

    const lngLat = [item.longitude, item.latitude];
    if (markers.has(item.id)) {
      const existingMarker = markers.get(item.id);
      existingMarker.setLngLat(lngLat);
      const labelEl = existingMarker.getElement().querySelector(".vtr-label");
      if (labelEl) labelEl.textContent = item.prefix || "";
      return;
    }

    const el = document.createElement("div");
    el.className = "vtr-marker";
    el.innerHTML = `
      <img class="vtr-image" src="./assets/viatura-bh.png" alt="Viatura GCM BH">
      <div class="vtr-label">${escapeHtml(item.prefix)}</div>
    `;

    el.addEventListener("click", (ev) => {
      ev.stopPropagation();
      fillForm(item);
    });

    const marker = new maplibregl.Marker({
      element: el,
      draggable: true,
      anchor: "center"
    }).setLngLat(lngLat).addTo(map);

    marker.on("dragend", async () => {
      const pos = marker.getLngLat();
      const updated = {
        ...item,
        longitude: pos.lng,
        latitude: pos.lat,
        updated_at: new Date().toISOString()
      };

      try {
        if (useSupabase) {
          const { error } = await supabaseClient
            .from("viaturas")
            .update({
              latitude: updated.latitude,
              longitude: updated.longitude,
              updated_at: updated.updated_at
            })
            .eq("id", item.id);
          if (error) throw error;
          await loadData();
        } else {
          currentData = currentData.map((x) => (x.id === item.id ? updated : x));
          saveLocal();
        }

        if (selectedId === item.id) {
          if (els.lat) els.lat.value = round6(updated.latitude);
          if (els.lng) els.lng.value = round6(updated.longitude);
        }

        renderAll();
        updateHelp("VTR reposicionada no mapa.");
      } catch (err) {
        console.error("Erro ao arrastar VTR:", err);
        updateHelp("Erro ao atualizar posição da VTR.");
      }
    });

    markers.set(item.id, marker);
  }

  function removeMarker(id) {
    if (!markers.has(id)) return;
    markers.get(id).remove();
    markers.delete(id);
  }

  function flyToVTR(item) {
    if (!mapReady) return;
    map.flyTo({
      center: [item.longitude, item.latitude],
      zoom: Math.max(map.getZoom(), 16),
      speed: 0.8
    });
  }

  function fitIfNeeded() {
    const visibleData = getVisibleData();
    if (!mapReady || !visibleData.length) return;

    if (visibleData.length === 1) {
      const item = visibleData[0];
      map.flyTo({ center: [item.longitude, item.latitude], zoom: 16 });
      return;
    }

    const bounds = new maplibregl.LngLatBounds();
    visibleData.forEach((item) => bounds.extend([item.longitude, item.latitude]));
    map.fitBounds(bounds, { padding: 80, maxZoom: 16, duration: 0 });
  }

  function setNowInfo() {
    if (!els.todayInfo) return;
    const totalAtivas = getVisibleData().length;
    els.todayInfo.textContent = `Agora: ${formatNow()} · VTRs visíveis: ${totalAtivas}`;
  }

  function normalizeRow(row) {
    return {
      id: row.id,
      prefix: row.prefix || "",
      team: row.team || "",
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      start_at: row.start_at || null,
      end_at: row.end_at || null,
      address_label: row.address_label || "",
      created_at: row.created_at || null,
      updated_at: row.updated_at || null
    };
  }

  function updateModeBadge() {
    if (!els.modeBadge) return;
    els.modeBadge.textContent = useSupabase ? "Online" : "Local";
  }

  function setMapStatus(text) {
    if (els.mapStatus) els.mapStatus.textContent = text;
  }

  function updateHelp(text) {
    if (els.helpText) els.helpText.textContent = text;
  }

  function round6(n) {
    return Number(n).toFixed(6);
  }

  function cryptoRandomId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `id_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  function parseDatetimeLocal(value) {
    if (!value) return null;
    const dt = new Date(value);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  function endOfDay(date) {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
  }

  function toDatetimeLocalValue(value) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  }

  function formatDateTime(value) {
    if (!value) return "--";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "--";
    return d.toLocaleString("pt-BR");
  }

  function formatNow() {
    return new Date().toLocaleString("pt-BR");
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
})();
