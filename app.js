(function () {
  const form = document.querySelector("#quoteForm");
  const toast = document.querySelector("#toast");
  const syncStatus = document.querySelector("#syncStatus");

  const serviceTypes = {
    full: {
      label: "Trasloco chiavi in mano",
      detail: "Smontaggio, imballaggio, carico, trasporto, scarico e rimontaggio",
      base: 1180,
    },
    standard: {
      label: "Trasloco standard",
      detail: "Carico, trasporto, scarico e supporto operativo",
      base: 780,
    },
    transport: {
      label: "Solo trasporto",
      detail: "Trasporto con furgone e conducente",
      base: 420,
    },
    lift: {
      label: "Noleggio autoscala",
      detail: "Autoscala con operatore per movimentazione esterna",
      base: 350,
    },
    disposal: {
      label: "Sgombero / smaltimento",
      detail: "Ritiro e conferimento materiale ingombrante",
      base: 520,
    },
  };

  const extraServices = [
    ["packing", "Imballaggio fragili", "Materiali e protezione oggetti delicati", 180],
    ["assembly", "Smontaggio e rimontaggio", "Mobili principali esclusa cucina complessa", 260],
    ["liftAccess", "Autoscala", "Accesso esterno o piano alto senza ascensore", 220],
    ["permits", "Permessi suolo pubblico", "Stima gestione area carico/scarico", 95],
    ["storage", "Deposito mobili", "Prima settimana di deposito", 160],
    ["urgent", "Urgenza", "Organizzazione con breve preavviso", 120],
  ];

  const selectors = {
    quoteNumber: "#quoteNumber",
    quoteTotal: "#quoteTotal",
    riskStatus: "#riskStatus",
    validUntil: "#validUntil",
    docQuoteNumber: "#docQuoteNumber",
    docDate: "#docDate",
    docValidity: "#docValidity",
    docClient: "#docClient",
    docContact: "#docContact",
    docRoute: "#docRoute",
    docMoveDate: "#docMoveDate",
    lineItems: "#lineItems",
    docNotes: "#docNotes",
    riskList: "#riskList",
    subtotalAmount: "#subtotalAmount",
    vatAmount: "#vatAmount",
    grandTotalAmount: "#grandTotalAmount",
    emailTo: "#emailTo",
    emailSubject: "#emailSubject",
    emailBody: "#emailBody",
    attachmentName: "#attachmentName",
    reviewCopy: "#reviewCopy",
  };

  const $ = (selector) => document.querySelector(selector);

  function money(value) {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(Math.max(0, value));
  }

  function dateLabel(value) {
    if (!value) return "-";
    const date = new Date(`${value}T12:00:00`);
    return new Intl.DateTimeFormat("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date);
  }

  function addDays(date, days) {
    const copy = new Date(date.getTime());
    copy.setDate(copy.getDate() + Number(days || 0));
    return copy;
  }

  function quoteId() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `ATL-${year}${month}${day}-014`;
  }

  function getData() {
    const data = Object.fromEntries(new FormData(form).entries());
    data.originFloor = Number(data.originFloor || 0);
    data.destFloor = Number(data.destFloor || 0);
    data.volume = Number(data.volume || 0);
    data.boxes = Number(data.boxes || 0);
    data.distance = Number(data.distance || 0);
    data.discount = Number(data.discount || 0);
    data.validDays = Number(data.validDays || 15);
    data.vatMode = Number(data.vatMode || 0);
    extraServices.forEach(([key]) => {
      data[key] = form.elements[key].checked;
    });
    return data;
  }

  function elevatorPenalty(data) {
    let total = 0;
    if (data.originElevator === "no") total += Math.max(0, data.originFloor) * 55;
    if (data.destElevator === "no") total += Math.max(0, data.destFloor) * 55;
    return total;
  }

  function buildLineItems(data) {
    const selectedType = serviceTypes[data.serviceType] || serviceTypes.standard;
    const items = [
      [selectedType.label, selectedType.detail, selectedType.base],
      ["Volume stimato", `${data.volume} mc`, data.volume * 22],
      ["Distanza", `${data.distance} km stimati`, data.distance * 1.8],
      ["Scatole", `${data.boxes} colli indicativi`, data.boxes * 2.5],
    ];

    const floorCost = elevatorPenalty(data);
    if (floorCost > 0) {
      items.push(["Accesso piani", "Maggiorazione per piano senza ascensore", floorCost]);
    }

    extraServices.forEach(([key, label, detail, amount]) => {
      if (data[key]) items.push([label, detail, amount]);
    });

    if (data.discount > 0) {
      items.push(["Sconto commerciale", "Applicato in fase di revisione", -data.discount]);
    }

    return items;
  }

  function riskFlags(data) {
    const flags = [];
    if (data.originElevator === "no" && data.originFloor >= 3) {
      flags.push("Partenza al terzo piano o superiore senza ascensore: verificare accesso e autoscala.");
    }
    if (data.destElevator === "no" && data.destFloor >= 3) {
      flags.push("Arrivo al terzo piano o superiore senza ascensore: verificare accesso e autoscala.");
    }
    if (data.liftAccess || data.serviceType === "lift") {
      flags.push("Autoscala richiesta: controllare spazio di manovra, balcone/finestra e permessi.");
    }
    if (data.permits) {
      flags.push("Permessi suolo pubblico inclusi come stima: confermare comune e tempistiche.");
    }
    if (data.urgent) {
      flags.push("Richiesta urgente: confermare disponibilita squadra e mezzi.");
    }
    if (data.volume >= 35) {
      flags.push("Volume elevato: valutare sopralluogo prima di inviare offerta finale.");
    }
    if (data.distance >= 150) {
      flags.push("Tratta lunga: verificare tempi guida, carburante, pedaggi e pernottamenti.");
    }
    return flags;
  }

  function renderLineItems(items) {
    return items
      .map(
        ([label, detail, amount]) => `
          <tr>
            <td><strong>${escapeHtml(label)}</strong></td>
            <td>${escapeHtml(detail)}</td>
            <td>${money(amount)}</td>
          </tr>
        `,
      )
      .join("");
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function emailText(data, total, id) {
    const firstName = (data.clientName || "Cliente").split(" ")[0];
    return `Gentile ${firstName},

in allegato trova il preventivo ${id} per il servizio di trasloco richiesto.

Il totale stimato e ${money(total)} IVA inclusa. Il preventivo resta valido fino alla data indicata nel documento.

Per confermare o modificare il servizio puo rispondere direttamente a questa email oppure contattarci al numero 039 2001106.

Cordiali saluti,
Atlantico Traslochi SRL`;
  }

  function render() {
    const data = getData();
    const items = buildLineItems(data);
    const subtotal = Math.max(0, items.reduce((sum, item) => sum + item[2], 0));
    const vat = subtotal * (data.vatMode / 100);
    const total = subtotal + vat;
    const id = quoteId();
    const today = new Date();
    const validDate = addDays(today, data.validDays);
    const risks = riskFlags(data);
    const reviewLabel = risks.length ? "Revisione consigliata" : "Pronto invio";
    const validityText = new Intl.DateTimeFormat("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(validDate);
    const todayText = new Intl.DateTimeFormat("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(today);

    $(selectors.quoteNumber).textContent = id;
    $(selectors.quoteTotal).textContent = money(total);
    $(selectors.riskStatus).textContent = reviewLabel;
    $(selectors.riskStatus).style.color = risks.length ? "var(--amber)" : "var(--green)";
    $(selectors.validUntil).textContent = validityText;

    $(selectors.docQuoteNumber).textContent = id;
    $(selectors.docDate).textContent = `Data: ${todayText}`;
    $(selectors.docValidity).textContent = `Validita: ${validityText}`;
    $(selectors.docClient).textContent = data.clientName || "-";
    $(selectors.docContact).textContent = `${data.clientEmail || "-"} | ${data.clientPhone || "-"}`;
    $(selectors.docRoute).textContent = `${data.origin || "-"} -> ${data.destination || "-"}`;
    $(selectors.docMoveDate).textContent = `Data trasloco: ${dateLabel(data.moveDate)}`;
    $(selectors.lineItems).innerHTML = renderLineItems(items);
    $(selectors.docNotes).textContent = data.notes || "Nessuna nota operativa.";
    $(selectors.riskList).innerHTML = risks.map((risk) => `<li>${escapeHtml(risk)}</li>`).join("");
    $(selectors.subtotalAmount).textContent = money(subtotal);
    $(selectors.vatAmount).textContent = money(vat);
    $(selectors.grandTotalAmount).textContent = money(total);

    $(selectors.emailTo).textContent = `A: ${data.clientEmail || "-"}`;
    $(selectors.emailSubject).textContent = `Oggetto: Preventivo ${id} - Atlantico Traslochi`;
    $(selectors.emailBody).textContent = emailText(data, total, id);
    $(selectors.attachmentName).textContent = `${id.toLowerCase()}-${slug(data.clientName || "cliente")}.pdf`;
    $(selectors.reviewCopy).textContent = risks.length
      ? "Sono presenti condizioni da verificare prima dell'invio."
      : "Anteprima pronta per approvazione e invio al cliente.";

    syncStatus.textContent = "Bozza sincronizzata";
    syncStatus.style.color = "var(--green)";
  }

  function slug(value) {
    return String(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("visible");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("visible"), 2600);
  }

  function setTab(name) {
    document.querySelectorAll(".tab").forEach((tab) => {
      const active = tab.dataset.tab === name;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", String(active));
    });

    document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.remove("active"));
    $(`#${name}Panel`).classList.add("active");
  }

  form.addEventListener("input", () => {
    syncStatus.textContent = "Aggiornamento...";
    syncStatus.style.color = "var(--amber)";
    render();
  });

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => setTab(tab.dataset.tab));
  });

  $("#printQuote").addEventListener("click", () => {
    setTab("quote");
    window.print();
  });

  $("#approveSend").addEventListener("click", () => {
    syncStatus.textContent = "Approvato per invio";
    syncStatus.style.color = "var(--blue)";
    showToast("Invio simulato: in n8n questo trigger spedirebbe email e PDF.");
  });

  $("#needsEdit").addEventListener("click", () => {
    syncStatus.textContent = "Richiede modifiche";
    syncStatus.style.color = "var(--red)";
    showToast("Bozza marcata da rivedere.");
  });

  $("#copyEmail").addEventListener("click", async () => {
    const body = $(selectors.emailBody).textContent;
    try {
      await navigator.clipboard.writeText(body);
      showToast("Testo email copiato.");
    } catch {
      showToast("Copia non disponibile in questo browser.");
    }
  });

  $("#resetDemo").addEventListener("click", () => {
    form.reset();
    render();
    showToast("Dati demo ripristinati.");
  });

  render();
})();
