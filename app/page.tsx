"use client";

import { useEffect, useState } from "react";
import { supabase, supabaseConfigured } from "./supabase";
import { createInvoicePdf, downloadInvoicePdf } from "./invoice-pdf";

type View =
  | "dashboard"
  | "klanten"
  | "verkoop"
  | "producten"
  | "offertes"
  | "facturen"
  | "inkoopfacturen"
  | "betalingen"
  | "kosten"
  | "rapportages"
  | "instellingen";
type Customer = {
  id: number;
  company: string;
  contact: string;
  email: string;
  phone: string;
  city: string;
  branch: string;
  status: string;
  revenue: number;
  purchases: number;
  lastOrder: string;
  nextFollow: string;
  note: string;
};
type Product = {
  id: number;
  name: string;
  sku: string;
  category: string;
  cost: number;
  price: number;
  priceIncludesVat?: boolean;
  vatRate?: number;
  stock: number;
  min: number;
  active: boolean;
  lastPurchaseQty?: number;
  lastPurchaseTotal?: number;
  stockInitialized?: boolean;
  supplier?: string;
  stockHistory?: Array<{
    id: number;
    date: string;
    type: "inkoop" | "afboeking";
    quantity: number;
    reason?: string;
    sourceInvoiceId?: number;
  }>;
};
type ParsedInvoice = {
  supplier: string;
  invoiceNumber: string;
  invoiceDate: string;
  currency: string;
  shippingFee: number;
  items: Array<{
    description: string;
    sku: string;
    quantity: number;
    lineTotal: number;
    unitCost: number;
  }>;
};
type Invoice = {
  id: number;
  number: string;
  customer: string;
  date: string;
  due: string;
  total: number;
  paid: number;
  status: string;
  customerEmail?: string;
  subtotal?: number;
  vatAmount?: number;
  vatRate?: number;
  lines?: Array<{ productId: number; description: string; quantity: number; unitPrice: number; total: number }>;
};
type PurchaseInvoice = {
  id: number;
  number: string;
  supplier: string;
  date: string;
  total: number;
  currency: string;
  fileName: string;
  filePath: string;
  itemCount: number;
};
type Quote = {
  id: number;
  number: string;
  customer: string;
  date: string;
  valid: string;
  total: number;
  status: string;
};
type Cost = {
  id: number;
  supplier: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  currency: string;
  status: string;
  originalAmount?: number;
  exchangeRate?: number;
  sourceInvoiceId?: number;
};

const euro = (n: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(
    n,
  );
const dateNL = (s: string) =>
  new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(s));
const today = new Date().toISOString().slice(0, 10);

const seedCustomers: Customer[] = [];
const seedProducts: Product[] = [];
const seedInvoices: Invoice[] = [];
const seedQuotes: Quote[] = [];
const seedCosts: Cost[] = [];

const nav = [
  ["dashboard", "▦", "Dashboard"],
  ["klanten", "♙", "Klanten"],
  ["verkoop", "⌁", "Verkoop"],
  ["producten", "□", "Producten"],
  ["offertes", "◇", "Offertes"],
  ["facturen", "▤", "Facturen"],
  ["inkoopfacturen", "⇩", "Inkoopfacturen"],
  ["betalingen", "€", "Betalingen"],
  ["kosten", "↘", "Kosten"],
  ["rapportages", "↗", "Rapportages"],
  ["instellingen", "⚙", "Instellingen"],
] as const;

function Badge({ children }: { children: React.ReactNode }) {
  const s = String(children).toLowerCase();
  const tone =
    s.includes("betaald") && !s.includes("gedeeltelijk")
      ? "green"
      : s.includes("te laat") || s.includes("afgewezen")
        ? "red"
        : s.includes("klant") || s.includes("geaccepteerd")
          ? "blue"
          : s.includes("verstuurd") ||
              s.includes("bekeken") ||
              s.includes("interesse")
            ? "amber"
            : "gray";
  return <span className={`badge ${tone}`}>{children}</span>;
}
function Icon({ children }: { children: React.ReactNode }) {
  return <span className="icon">{children}</span>;
}
function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <span>✓</span>
      <b>{text}</b>
    </div>
  );
}

function AuthScreen() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!supabaseConfigured) {
      setMessage("De Supabase-koppeling ontbreekt in deze deployment. Voeg de twee Supabase-variabelen toe in Vercel.");
      return;
    }
    setBusy(true);
    setMessage("");
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    const result = await supabase.auth.signInWithPassword({ email, password });
    if (result.error)
      setMessage("Inloggen is niet gelukt. Controleer je e-mailadres en wachtwoord.");
    setBusy(false);
  };
  return (
    <div className="auth-page">
      <div className="auth-panel">
        <div className="logo">W</div>
        <span className="eyebrow">WGMN DIGITAL</span>
        <h1>Welkom terug, Auke</h1>
        <form onSubmit={submit}>
          <label>E-mailadres<input name="email" type="email" required autoComplete="email" /></label>
          <label>Wachtwoord<input name="password" type="password" minLength={12} required autoComplete="current-password" /></label>
          {message && <div className="auth-message">{message}</div>}
          <button className="primary" disabled={busy}>{busy ? "Even wachten…" : "Inloggen"}</button>
        </form>
      </div>
    </div>
  );
}

export default function Home() {
  const [view, setView] = useState<View>("dashboard");
  const [menu, setMenu] = useState(false);
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [customers, setCustomers] = useState(seedCustomers);
  const [products, setProducts] = useState(seedProducts);
  const [invoices, setInvoices] = useState(seedInvoices);
  const [purchaseInvoices, setPurchaseInvoices] = useState<PurchaseInvoice[]>([]);
  const [quotes, setQuotes] = useState(seedQuotes);
  const [costs, setCosts] = useState(seedCosts);
  const [period, setPeriod] = useState("Maand");
  const [selected, setSelected] = useState<Customer | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<"laden" | "opgeslagen" | "fout">("laden");
  const [needsPasskey, setNeedsPasskey] = useState(false);
  const [passkeySetupBusy, setPasskeySetupBusy] = useState(false);
  const [passkeySetupError, setPasskeySetupError] = useState("");

  useEffect(() => {
    // Verwijder een eventuele oude, onversleutelde browserkopie van de CRM-data
    // en oude Supabase-sessies uit localStorage.
    localStorage.removeItem("nfc-administratie");
    Object.keys(localStorage)
      .filter((key) => key.startsWith("sb-") && key.endsWith("-auth-token"))
      .forEach((key) => localStorage.removeItem(key));

    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user.id ?? null);
      setAuthReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
      setAuthReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) return;
    const timeoutMs = 30 * 60 * 1000;
    let timer: ReturnType<typeof setTimeout>;
    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void supabase.auth.signOut(), timeoutMs);
    };
    const events = ["pointerdown", "keydown", "touchstart"] as const;
    events.forEach((event) => window.addEventListener(event, resetTimer, { passive: true }));
    resetTimer();
    return () => {
      clearTimeout(timer);
      events.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [userId]);

  useEffect(() => {
    if (!userId || !("PublicKeyCredential" in window)) return;
    let active = true;
    supabase.auth.passkey.list().then(({ data, error }) => {
      if (active && !error && Array.isArray(data) && data.length === 0) setNeedsPasskey(true);
    });
    return () => { active = false; };
  }, [userId]);

  const setupPasskey = async () => {
    setPasskeySetupBusy(true);
    setPasskeySetupError("");
    const { error } = await supabase.auth.registerPasskey();
    if (error) setPasskeySetupError("De passkey kon niet worden gekoppeld of de actie is geannuleerd.");
    else {
      setNeedsPasskey(false);
      notify("Passkey gekoppeld — voortaan kun je zonder wachtwoord inloggen");
    }
    setPasskeySetupBusy(false);
  };

  useEffect(() => {
    if (!userId) {
      setLoaded(false);
      return;
    }
    let active = true;
    (async () => {
      setSyncStatus("laden");
      const { data, error } = await supabase
        .from("crm_state")
        .select("customers,products,invoices,purchase_invoices,quotes,costs")
        .eq("user_id", userId)
        .maybeSingle();
      if (!active) return;
      if (error) {
        setSyncStatus("fout");
        setLoaded(true);
        return;
      }
      if (data) {
        const loadedPurchaseInvoices: PurchaseInvoice[] = data.purchase_invoices || [];
        const loadedProducts: Product[] = data.products || [];
        const repairedProducts = loadedProducts.map((product) => {
          if (!product.stockInitialized && (product.lastPurchaseQty || 0) > 0) {
            return {
              ...product,
              stock: product.stock === 0 ? product.lastPurchaseQty || 0 : product.stock,
              stockInitialized: true,
            };
          }
          if (product.stock !== 0 || !(product.stockHistory || []).length) return product;
          const incoming = (product.stockHistory || []).filter((movement) => movement.type === "inkoop").reduce((sum, movement) => sum + movement.quantity, 0);
          const outgoing = (product.stockHistory || []).filter((movement) => movement.type === "afboeking").reduce((sum, movement) => sum + movement.quantity, 0);
          const calculatedStock = Math.max(0, incoming - outgoing);
          return calculatedStock > 0 ? { ...product, stock: calculatedStock } : product;
        });
        const loadedCosts: Cost[] = data.costs || [];
        const restoredInvoiceCosts: Cost[] = loadedPurchaseInvoices
          .filter(
            (invoice) =>
              (invoice.currency || "EUR").toUpperCase() === "EUR" &&
              !loadedCosts.some((cost) => cost.sourceInvoiceId === invoice.id),
          )
          .map((invoice) => ({
            id: invoice.id,
            supplier: invoice.supplier || "Onbekende leverancier",
            date: invoice.date || today,
            category: "Inkoop",
            description: `Inkoopfactuur ${invoice.number || invoice.fileName}`,
            amount: invoice.total,
            currency: "EUR",
            originalAmount: invoice.total,
            exchangeRate: 1,
            status: "Betaald",
            sourceInvoiceId: invoice.id,
          }));
        setCustomers(data.customers || []);
        setProducts(repairedProducts);
        setInvoices(data.invoices || []);
        setPurchaseInvoices(loadedPurchaseInvoices);
        setQuotes(data.quotes || []);
        setCosts([...restoredInvoiceCosts, ...loadedCosts]);
      } else {
        const cleaned = {
          customers: [],
          products: [],
          invoices: [],
          purchaseInvoices: [],
          quotes: [],
          costs: [],
        };
        setCustomers(cleaned.customers);
        setProducts(cleaned.products);
        setInvoices(cleaned.invoices);
        setPurchaseInvoices(cleaned.purchaseInvoices);
        setQuotes(cleaned.quotes);
        setCosts(cleaned.costs);
        await supabase.from("crm_state").insert({
          user_id: userId,
          customers: cleaned.customers,
          products: cleaned.products,
          invoices: cleaned.invoices,
          purchase_invoices: cleaned.purchaseInvoices,
          quotes: cleaned.quotes,
          costs: cleaned.costs,
        });
      }
      setLoaded(true);
      setSyncStatus("opgeslagen");
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!loaded || !userId) return;
    setSyncStatus("laden");
    const timer = setTimeout(async () => {
      const state = { customers, products, invoices, purchase_invoices: purchaseInvoices, quotes, costs };
      const { error } = await supabase.from("crm_state").upsert({
        user_id: userId,
        ...state,
        updated_at: new Date().toISOString(),
      });
      setSyncStatus(error ? "fout" : "opgeslagen");
    }, 500);
    return () => clearTimeout(timer);
  }, [customers, products, invoices, purchaseInvoices, quotes, costs, loaded, userId]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 2800);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const totalRevenue = invoices.reduce((a, i) => a + i.total, 0);
  const currentMonth = today.slice(0, 7);
  const monthlyRevenue = invoices
    .filter((i) => i.date.startsWith(currentMonth))
    .reduce((a, i) => a + i.total, 0);
  const outstanding = invoices.reduce(
    (a, i) => a + Math.max(0, i.total - i.paid),
    0,
  );
  const paid = invoices.reduce((a, i) => a + i.paid, 0);
  const costTotal = costs.reduce((a, c) => a + c.amount, 0);
  const filter = (s: string) => s.toLowerCase().includes(query.toLowerCase());
  const go = (v: View) => {
    setView(v);
    setMenu(false);
    setQuery("");
  };
  const notify = (s: string) => setToast(s);

  if (!authReady) return <div className="auth-loading">Administratie laden…</div>;
  if (!userId) return <AuthScreen />;

  const content =
    view === "dashboard" ? (
      <Dashboard
        {...{
          go,
          totalRevenue,
          monthlyRevenue,
          outstanding,
          paid,
          costTotal,
          products,
          invoices,
          customers,
          period,
          setPeriod,
          setModal,
        }}
      />
    ) : view === "klanten" ? (
      <Customers
        {...{ customers, setCustomers, query, setModal, setSelected, go }}
      />
    ) : view === "verkoop" ? (
      <Sales {...{ customers, setCustomers, setSelected, setModal, quotes }} />
    ) : view === "producten" ? (
      <Products {...{ products, setProducts, query, setModal, notify }} />
    ) : view === "offertes" ? (
      <Quotes {...{ quotes, setQuotes, query, setModal, notify, go }} />
    ) : view === "facturen" ? (
      <Invoices {...{ invoices, setInvoices, customers, query, setModal, notify }} />
    ) : view === "inkoopfacturen" ? (
      <PurchaseInvoices {...{ purchaseInvoices, setPurchaseInvoices, products, setProducts, setCosts, query, setModal, notify }} />
    ) : view === "betalingen" ? (
      <Payments {...{ invoices, setInvoices, setModal, notify }} />
    ) : view === "kosten" ? (
      <Costs {...{ costs, setCosts, query, setModal }} />
    ) : view === "rapportages" ? (
      <Reports {...{ totalRevenue, costTotal, outstanding, paid, products, invoices }} />
    ) : (
      <Settings notify={notify} />
    );

  return (
    <div className="app">
      <aside className={menu ? "open" : ""}>
        <div className="brand">
          <div className="logo">W</div>
          <div>
            <b>WGMN Digital</b>
            <small>Digitale oplossingen, helder geregeld</small>
          </div>
        </div>
        <nav>
          {nav.map(([id, ic, label]) => (
            <button
              key={id}
              className={view === id ? "active" : ""}
              onClick={() => go(id)}
            >
              <Icon>{ic}</Icon>
              {label}
              {id === "facturen" &&
                invoices.filter((i) => i.total > i.paid).length > 0 && (
                  <span className="count">
                    {invoices.filter((i) => i.total > i.paid).length}
                  </span>
                )}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="avatar">AU</div>
          <div>
            <b>Auke</b>
            <small>{syncStatus === "opgeslagen" ? "✓ Opgeslagen in Supabase" : syncStatus === "fout" ? "Opslagfout" : "Opslaan…"}</small>
          </div>
          <button title="Uitloggen" onClick={() => supabase.auth.signOut()}>↪</button>
        </div>
      </aside>
      {menu && <div className="scrim" onClick={() => setMenu(false)} />}
      <main>
        <header>
          <button className="mobile-menu" onClick={() => setMenu(true)}>
            ☰
          </button>
          <div className="search">
            <span>⌕</span>
            <input
              aria-label="Zoeken"
              placeholder="Zoek klant, factuur, offerte..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <kbd>⌘ K</kbd>
          </div>
          <button className="notify">♢</button>
          <button className="quick" onClick={() => setModal("quick")}>
            ＋ <span>Snelle invoer</span>
          </button>
        </header>
        <section className="content">{content}</section>
      </main>
      {modal && (
        <Modal
          type={modal}
          close={() => {
            setModal(null);
            setSelected(null);
          }}
          {...{
            setModal,
            customers,
            setCustomers,
            products,
            setProducts,
            invoices,
            setInvoices,
            purchaseInvoices,
            setPurchaseInvoices,
            quotes,
            setQuotes,
            costs,
            setCosts,
            selected,
            notify,
            go,
          }}
        />
      )}
      {toast && <div className="toast">✓ {toast}</div>}
      {needsPasskey && (
        <div className="passkey-setup-banner" role="dialog" aria-modal="true" aria-labelledby="passkey-title">
          <div>
            <span className="passkey-symbol">◉</span>
            <h2 id="passkey-title">Maak je passkey aan</h2>
            <p>Koppel dit apparaat één keer. Daarna log je rechtstreeks in met je passkey, zonder e-mailadres of wachtwoord.</p>
            {passkeySetupError && <div className="auth-message">{passkeySetupError}</div>}
            <button className="primary" disabled={passkeySetupBusy} onClick={setupPasskey}>
              {passkeySetupBusy ? "Passkey koppelen…" : "Passkey aanmaken"}
            </button>
            <button className="auth-switch" onClick={() => setNeedsPasskey(false)}>Later instellen</button>
          </div>
        </div>
      )}
    </div>
  );
}

function PageHead({
  eyebrow,
  title,
  desc,
  action,
  onAction,
}: {
  eyebrow?: string;
  title: string;
  desc: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="page-head">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        <p>{desc}</p>
      </div>
      {action && (
        <button className="primary" onClick={onAction}>
          ＋ {action}
        </button>
      )}
    </div>
  );
}

function Dashboard(p: any) {
  const amsterdamHour = Number(
    new Intl.DateTimeFormat("nl-NL", {
      hour: "2-digit",
      hour12: false,
      timeZone: "Europe/Amsterdam",
    }).format(new Date()),
  );
  const greeting =
    amsterdamHour < 12
      ? "Goedemorgen"
      : amsterdamHour < 18
        ? "Goedemiddag"
        : "Goedenavond";
  const followUps = p.customers.filter(
    (c: Customer) => c.nextFollow && c.nextFollow <= today,
  );
  const lowStock = p.products.filter((x: Product) => x.stock < x.min);
  return (
    <>
      <PageHead
        eyebrow="VANDAAG"
        title={`${greeting}, Auke`}
        desc="Dit is wat er vandaag speelt in je bedrijf."
        action="Nieuwe verkoop"
        onAction={() => p.setModal("sale")}
      />
      {p.customers.length === 0 &&
      p.invoices.length === 0 &&
      p.products.length === 0 ? (
        <div className="start-dashboard">
          <div>
            <span>✦</span>
            <h2>Vul je dashboard met je eigen gegevens</h2>
            <p>
              Begin met je eerste klant, product of zakelijke uitgave. Alle
              bedragen en overzichten worden daarna automatisch bijgewerkt.
            </p>
          </div>
          <div>
            <button onClick={() => p.setModal("customer")}>
              ＋ Eerste klant toevoegen
            </button>
            <button onClick={() => p.setModal("product")}>
              ＋ Eerste product toevoegen
            </button>
            <button onClick={() => p.setModal("cost")}>
              ＋ Uitgave toevoegen
            </button>
          </div>
        </div>
      ) : (
        followUps.length > 0 && (
          <div className="reminder">
            <div className="rem-icon">♢</div>
            <div>
              <b>
                {followUps.length} opvolgactie
                {followUps.length !== 1 ? "s" : ""} gepland
              </b>
              <span>Bekijk welke klanten je wilt benaderen.</span>
            </div>
            <button onClick={() => p.go("verkoop")}>Bekijk acties →</button>
          </div>
        )
      )}
      <div className="kpis">
        <Kpi
          icon="↗"
          label="Totale omzet"
          value={euro(p.totalRevenue)}
          sub="op basis van je facturen"
          onClick={() => p.go("rapportages")}
        />
        <Kpi
          icon="◷"
          label="Omzet deze maand"
          value={euro(p.monthlyRevenue)}
          sub={`${p.invoices.filter((i: Invoice) => i.date.startsWith(today.slice(0, 7))).length} facturen`}
          onClick={() => p.go("facturen")}
        />
        <Kpi
          icon="✓"
          label="Ontvangen"
          value={euro(p.paid)}
          sub="geregistreerde betalingen"
          onClick={() => p.go("betalingen")}
        />
        <Kpi
          icon="↘"
          label="Zakelijke kosten"
          value={euro(p.costTotal)}
          sub="zelf ingevoerde kosten"
          onClick={() => p.go("kosten")}
        />
        <Kpi
          icon="◆"
          label="Geschatte brutowinst"
          value={euro(p.totalRevenue - p.costTotal)}
          sub="omzet min kosten"
          onClick={() => p.go("rapportages")}
        />
        <Kpi
          icon="□"
          label="Lage voorraad"
          value={`${lowStock.length} product${lowStock.length !== 1 ? "en" : ""}`}
          sub={lowStock.length ? "actie nodig" : "voorraad op peil"}
          warn={lowStock.length > 0}
          onClick={() => p.go("producten")}
        />
      </div>
      <div className="grid-2 wide-left">
        <div className="card chart-card">
          <div className="card-head">
            <div>
              <h2>Omzetontwikkeling</h2>
              <p>Wordt gevuld vanuit je eigen facturen</p>
            </div>
            <div className="segment">
              {["Week", "Maand", "Jaar"].map((x) => (
                <button
                  key={x}
                  className={p.period === x ? "active" : ""}
                  onClick={() => p.setPeriod(x)}
                >
                  {x}
                </button>
              ))}
            </div>
          </div>
          {p.invoices.length ? (
              <Chart period={p.period} invoices={p.invoices} />
          ) : (
            <Empty text="Voeg een factuur toe om je omzetgrafiek te vullen" />
          )}
        </div>
        <div className="card">
          <div className="card-head">
            <div>
              <h2>Mijn producten</h2>
              <p>Jouw eigen assortiment</p>
            </div>
            <button className="link" onClick={() => p.go("producten")}>
              Bekijk alles
            </button>
          </div>
          {p.products.length ? (
            <div className="rank">
              {p.products.slice(0, 4).map((r: Product, index: number) => (
                <div key={r.id}>
                  <span>{index + 1}</span>
                  <div>
                    <b>{r.name}</b>
                    <small>{r.stock} op voorraad</small>
                  </div>
                  <strong>{euro(r.price)}</strong>
                </div>
              ))}
            </div>
          ) : (
            <Empty text="Voeg je eerste product toe" />
          )}
        </div>
      </div>
      <div className="grid-2">
        <div className="card">
          <div className="card-head">
            <div>
              <h2>Recente facturen</h2>
              <p>De laatste mutaties</p>
            </div>
            <button className="link" onClick={() => p.go("facturen")}>
              Alle facturen →
            </button>
          </div>
          {p.invoices.length ? (
            <div className="list">
              {p.invoices.slice(0, 4).map((i: Invoice) => (
                <button key={i.id} onClick={() => p.go("facturen")}>
                  <div className="doc-icon">▤</div>
                  <div>
                    <b>{i.number}</b>
                    <small>
                      {i.customer} · {dateNL(i.date)}
                    </small>
                  </div>
                  <strong>{euro(i.total)}</strong>
                  <Badge>{i.status}</Badge>
                </button>
              ))}
            </div>
          ) : (
            <Empty text="Nog geen facturen toegevoegd" />
          )}
        </div>
        <div className="card">
          <div className="card-head">
            <div>
              <h2>Opnieuw benaderen</h2>
              <p>Kansen voor een herhaalaankoop</p>
            </div>
            <button className="link" onClick={() => p.go("verkoop")}>
              Verkooplijst →
            </button>
          </div>
          {p.customers.some((c: Customer) => c.purchases > 0) ? (
            <div className="list contacts">
              {p.customers
                .filter((c: Customer) => c.purchases > 0)
                .slice(0, 3)
                .map((c: Customer) => (
                  <button key={c.id} onClick={() => p.go("verkoop")}>
                    <div className="avatar small">
                      {c.company
                        .split(" ")
                        .map((x) => x[0])
                        .slice(0, 2)
                        .join("")}
                    </div>
                    <div>
                      <b>{c.company}</b>
                      <small>Laatste aankoop {dateNL(c.lastOrder)}</small>
                    </div>
                    <span>Benaderen →</span>
                  </button>
                ))}
            </div>
          ) : (
            <Empty text="Voeg klanten en verkopen toe voor herhaalkansen" />
          )}
        </div>
      </div>
      <p className="disclaimer">
        ℹ Financiële overzichten zijn een hulpmiddel en geen officiële aangifte
        of vervanging van een boekhouder.
      </p>
    </>
  );
}
function Kpi({ icon, label, value, trend, sub, warn, danger, onClick }: any) {
  return (
    <button
      className={`kpi ${warn ? "warn" : ""} ${danger ? "danger" : ""}`}
      onClick={onClick}
    >
      <div className="kpi-icon">{icon}</div>
      <span>{label}</span>
      <b>{value}</b>
      <small className={trend ? "positive" : ""}>
        {trend || sub} {trend && <em>t.o.v. vorig jaar</em>}
      </small>
      <i>›</i>
    </button>
  );
}
function Chart({ period, invoices=[] }: { period: string; invoices?:Invoice[] }) {
  const labels=period === "Week"?["ma","di","wo","do","vr","za","zo"]:period === "Jaar"?["jan","feb","mrt","apr","mei","jun","jul","aug","sep","okt","nov","dec"]:["1","2","3","4","5","6","7","8","9","10","11","12"];
  const amounts=labels.map((_,index)=>invoices.filter((invoice)=>period==="Jaar"?new Date(invoice.date).getMonth()===index:period==="Week"?((new Date(invoice.date).getDay()+6)%7)===index:Math.min(11,Math.floor((new Date(invoice.date).getDate()-1)/3))===index).reduce((sum,invoice)=>sum+invoice.total,0));
  const max=Math.max(...amounts,1);
  const bars=amounts.map(amount=>Math.max(amount?6:0,amount/max*100));
  return (
    <div className="chart">
      <div className="ylabels">
        <span>€ 5k</span>
        <span>€ 4k</span>
        <span>€ 3k</span>
        <span>€ 2k</span>
        <span>€ 1k</span>
        <span>€ 0</span>
      </div>
      <div className="bars">
        {bars.map((b, i) => (
          <div key={i}>
            <span style={{ height: `${b}%` }} title={euro(amounts[i])}></span>
            <small>{labels[i]}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function Customers(p: any) {
  const rows = p.customers.filter((c: Customer) =>
    [c.company, c.contact, c.city, c.branch, c.status].some(
      p.filter ||
        ((x: string) => x.toLowerCase().includes(p.query.toLowerCase())),
    ),
  );
  return (
    <>
      <PageHead
        title="Klanten"
        desc={`${p.customers.length} relaties en verkoopkansen`}
        action="Nieuwe klant"
        onAction={() => p.setModal("customer")}
      />
      <div className="toolbar">
        <div className="filters">
          <button className="active">Alle klanten</button>
          <button>Prospects</button>
          <button>Opvolging nodig</button>
        </div>
        <button className="secondary">⇩ Exporteren</button>
      </div>
      <div className="card table-card">
        <table>
          <thead>
            <tr>
              <th>Bedrijf</th>
              <th>Contactpersoon</th>
              <th>Branche</th>
              <th>Status</th>
              <th>Laatste aankoop</th>
              <th>Omzet</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c: Customer) => (
              <tr
                key={c.id}
                onClick={() => {
                  p.setSelected(c);
                  p.setModal("customer-detail");
                }}
              >
                <td>
                  <div className="company">
                    <div className="avatar small">
                      {c.company.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <b>{c.company}</b>
                      <small>{c.city}</small>
                    </div>
                  </div>
                </td>
                <td>
                  <b>{c.contact}</b>
                  <small>{c.email}</small>
                </td>
                <td>{c.branch}</td>
                <td>
                  <Badge>{c.status}</Badge>
                </td>
                <td>{c.lastOrder ? dateNL(c.lastOrder) : "—"}</td>
                <td>
                  <b>{euro(c.revenue)}</b>
                </td>
                <td>›</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <Empty text="Geen klanten gevonden" />}
      </div>
    </>
  );
}
function Sales(p: any) {
  const due = p.customers.filter((c: Customer) => c.nextFollow <= today);
  return (
    <>
      <PageHead
        title="Verkoopopvolging"
        desc="Je commerciële kansen, overzichtelijk op één plek"
        action="Contactmoment toevoegen"
        onAction={() => p.setModal("contact")}
      />
      <div className="sales-summary">
        <Kpi
          icon="◷"
          label="Vandaag opvolgen"
          value={`${due.length} klanten`}
          warn
        />
        <Kpi
          icon="◇"
          label="Open offertes"
          value={`${p.quotes.filter((q:Quote)=>!["Geaccepteerd","Afgewezen","Verlopen","Omgezet naar factuur"].includes(q.status)).length} offertes`}
          sub={euro(p.quotes.filter((q:Quote)=>!["Geaccepteerd","Afgewezen","Verlopen","Omgezet naar factuur"].includes(q.status)).reduce((a:number,q:Quote)=>a+q.total,0))}
        />
        <Kpi
          icon="↻"
          label="Herhaalkansen"
          value={`${p.customers.filter((c:Customer)=>c.purchases>0).length} klanten`}
          sub="60+ dagen geleden"
        />
      </div>
      <div className="kanban">
        {[
          ["Vandaag", due, "red"],
          [
            "Deze week",
            p.customers
              .filter((c: Customer) => c.nextFollow > today)
              .slice(0, 3),
            "amber",
          ],
          [
            "Herhaalaankoop",
            p.customers.filter((c: Customer) => c.purchases > 0),
            "green",
          ],
        ].map((col: any) => (
          <div className="kanban-col" key={col[0]}>
            <h3>
              <i className={col[2]} />
              {col[0]} <span>{col[1].length}</span>
            </h3>
            {col[1].map((c: Customer) => (
              <div className="lead-card" key={c.id}>
                <div>
                  <b>{c.company}</b>
                  <Badge>{c.status}</Badge>
                </div>
                <p>{c.note}</p>
                <small>◷ {dateNL(c.nextFollow)}</small>
                <div>
                  <button
                    onClick={() => {
                      p.setSelected(c);
                      p.setModal("contact");
                    }}
                  >
                    ＋ Contact
                  </button>
                  <button
                    onClick={() => {
                      p.setSelected(c);
                      p.setModal("customer-detail");
                    }}
                  >
                    Bekijken
                  </button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
function Products(p: any) {
  const rows = p.products.filter((x: Product) =>
    [x.name, x.sku, x.category].some((s) =>
      s.toLowerCase().includes(p.query.toLowerCase()),
    ),
  );
  return (
    <>
      <PageHead
        title="Mijn assortiment"
        desc="Voeg producten toe en registreer eenvoudig wat je hebt ingekocht"
        action="Product toevoegen"
        onAction={() => p.setModal("product")}
      />
      <div className="toolbar inventory-toolbar">
        <div />
        <button className="secondary" onClick={() => p.setModal("invoice-import")}>
          ⇧ Inkoopfactuur uploaden
        </button>
      </div>
      <div className="inventory">
        <div>
          <small>INKOOPWAARDE VOORRAAD</small>
          <b>
            {euro(
              p.products.reduce(
                (a: number, x: Product) =>
                  a + x.cost * (x.stock === 999 ? 0 : x.stock),
                0,
              ),
            )}
          </b>
        </div>
        <div>
          <small>VERWACHTE VERKOOPWAARDE</small>
          <b>
            {euro(
              p.products.reduce(
                (a: number, x: Product) =>
                  a + x.price * (x.stock === 999 ? 0 : x.stock),
                0,
              ),
            )}
          </b>
        </div>
        <div className="stock-alert">
          <span>!</span>
          <div>
            <b>
              {p.products.filter((x: Product) => x.stock < x.min).length}{" "}
              product onder minimum
            </b>
            <small>Vul je voorraad tijdig aan</small>
          </div>
        </div>
      </div>
      <div className="product-grid">
        {rows.map((x: Product) => (
          <div className="product-card" key={x.id}>
            <div className="product-visual">
              {x.category === "Service" ? "✦" : x.category === "QR" ? "▦" : "◉"}
            </div>
            <div className="product-info">
              <div>
                <span>{x.category}</span>
                <Badge>{x.active ? "Actief" : "Niet leverbaar"}</Badge>
              </div>
              <h3>{x.name}</h3>
              <small>{x.sku}</small>
              <div className="price">
                <b>{euro(x.price)}</b>
                <span>Verkoopprijs {x.priceIncludesVat === false ? "excl. btw" : "incl. btw"}</span>
              </div>
              <div className="unit-cost">
                <small>KOSTPRIJS PER STUK</small>
                <strong>{euro(x.cost)}</strong>
                {x.lastPurchaseQty && (
                  <span>
                    Laatste inkoop: {x.lastPurchaseQty} stuks voor{" "}
                    {euro(x.lastPurchaseTotal || 0)}
                  </span>
                )}
              </div>
              <div className="margin">
                <span>Marge per stuk</span>
                <b>
                  {x.price
                    ? Math.round(((x.price - x.cost) / x.price) * 100)
                    : 0}
                  %
                </b>
                <i>
                  <em
                    style={{
                      width: `${Math.max(0, Math.min(100, x.price ? ((x.price - x.cost) / x.price) * 100 : 0))}%`,
                    }}
                  />
                </i>
              </div>
              <div className={`stock ${x.stock < x.min ? "low" : ""}`}>
                <span>Voorraad</span>
                <b>{x.stock === 999 ? "Onbeperkt" : `${x.stock} stuks`}</b>
                {x.stock < x.min && <small>Minimum: {x.min}</small>}
              </div>
              <div className="stock-actions">
                <button className="purchase-button" onClick={() => p.setModal(`stock-order:${x.id}`)}>
                  ＋ Inkoop
                </button>
                <button className="writeoff-button" disabled={x.stock === 999 || x.stock < 1} onClick={() => p.setModal(`stock-writeoff:${x.id}`)}>
                  − Afboeken
                </button>
              </div>
              <button className="edit-price-button" onClick={() => p.setModal(`product-price:${x.id}`)}>Product en prijs bewerken</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
function Quotes(p: any) {
  const rows = p.quotes.filter((q: Quote) =>
    [q.number, q.customer, q.status].some((s) =>
      s.toLowerCase().includes(p.query.toLowerCase()),
    ),
  );
  return (
    <>
      <PageHead
        title="Offertes"
        desc="Maak en volg professionele offertes"
        action="Nieuwe offerte"
        onAction={() => p.setModal("quote")}
      />
      <DocTable
        type="offerte"
        rows={rows}
        actions={(q: Quote) => (
          <>
            <button onClick={() => p.notify(`${q.number} als PDF klaargezet`)}>
              PDF
            </button>
            {q.status !== "Geaccepteerd" && (
              <button
                onClick={() =>
                  p.setQuotes((a: Quote[]) =>
                    a.map((x) =>
                      x.id === q.id ? { ...x, status: "Geaccepteerd" } : x,
                    ),
                  )
                }
              >
                Accepteren
              </button>
            )}
            <button
              onClick={() => {
                p.setInvoices((a: Invoice[]) => [
                  ...a,
                  {
                    id: Date.now(),
                    number: `FAC-2026-${String(43 + a.length).padStart(4, "0")}`,
                    customer: q.customer,
                    date: today,
                    due: "2026-08-08",
                    total: q.total,
                    paid: 0,
                    status: "Concept",
                  },
                ]);
                p.setQuotes((a: Quote[]) =>
                  a.map((x) =>
                    x.id === q.id
                      ? { ...x, status: "Omgezet naar factuur" }
                      : x,
                  ),
                );
                p.notify("Offerte omgezet naar factuur");
              }}
            >
              Naar factuur
            </button>
          </>
        )}
      />
    </>
  );
}
function Invoices(p: any) {
  const rows = p.invoices.filter((q: Invoice) =>
    [q.number, q.customer, q.status].some((s) =>
      s.toLowerCase().includes(p.query.toLowerCase()),
    ),
  );
  return (
    <>
      <PageHead
        title="Facturen"
        desc="Overzicht van alle facturen en betalingen"
        action="Nieuwe factuur"
        onAction={() => p.setModal("invoice")}
      />
      <div className="mini-kpis">
        <div>
          <span>Openstaand</span>
          <b>
            {euro(
              rows.reduce((a: number, i: Invoice) => a + i.total - i.paid, 0),
            )}
          </b>
        </div>
        <div>
          <span>Deze maand gefactureerd</span>
          <b>{euro(rows.reduce((a: number, i: Invoice) => a + i.total, 0))}</b>
        </div>
        <div>
          <span>Betaald</span>
          <b>{euro(rows.reduce((a: number, i: Invoice) => a + i.paid, 0))}</b>
        </div>
      </div>
      <DocTable
        type="factuur"
        rows={rows}
        actions={(i: Invoice) => (
          <>
            <button onClick={async () => {
              if (!i.lines?.length) return p.notify("Deze oudere factuur bevat nog geen productregels voor een PDF");
              const customer = p.customers.find((item: Customer) => item.company === i.customer);
              const blob = await createInvoicePdf({ number: i.number, date: i.date, due: i.due, customer: { company: i.customer, contact: customer?.contact, email: i.customerEmail || customer?.email, city: customer?.city }, lines: i.lines, total: i.total, subtotal: i.subtotal, vatAmount: i.vatAmount, vatRate: i.vatRate || 21 });
              downloadInvoicePdf(blob, i.number);
              p.notify(`${i.number}.pdf gedownload`);
            }}>
              PDF
            </button>
            {i.status !== "Betaald" && (
              <button onClick={() => p.setModal(`payment:${i.id}`)}>
                Betaling
              </button>
            )}
            <button
              onClick={() =>
                p.notify("Nederlandstalige begeleidende e-mail gegenereerd")
              }
            >
              E-mail
            </button>
          </>
        )}
      />
    </>
  );
}
function PurchaseInvoices(p: any) {
  const rows = p.purchaseInvoices.filter((invoice: PurchaseInvoice) =>
    [invoice.number, invoice.supplier, invoice.fileName].some((value) =>
      value.toLowerCase().includes(p.query.toLowerCase()),
    ),
  );
  const openInvoice = async (invoice: PurchaseInvoice) => {
    const { data, error } = await supabase.storage.from("invoices").createSignedUrl(invoice.filePath, 60);
    if (error || !data?.signedUrl) return p.notify("Factuurbestand kon niet worden geopend");
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };
  const writeOff = async (invoice: PurchaseInvoice) => {
    if (!window.confirm(`Inkoopfactuur ${invoice.number || invoice.fileName} afboeken? De kosten en voorraad worden teruggedraaid.`)) return;
    const { error } = await supabase.storage.from("invoices").remove([invoice.filePath]);
    if (error) return p.notify("Afboeken gestopt: het factuurbestand kon niet veilig worden verwijderd");
    const reason = `Factuur ${invoice.number || "zonder nummer"}`;
    const matches = (movement: NonNullable<Product["stockHistory"]>[number]) =>
      movement.type === "inkoop" &&
      (movement.sourceInvoiceId === invoice.id ||
        (!movement.sourceInvoiceId && movement.reason === reason && movement.date === invoice.date));
    const reversedQuantity = p.products.reduce((sum: number, product: Product) =>
      sum + (product.stockHistory || []).filter(matches).reduce((quantity, movement) => quantity + movement.quantity, 0), 0);
    p.setProducts((current: Product[]) => current.map((product) => {
      const quantity = (product.stockHistory || []).filter(matches).reduce((sum, movement) => sum + movement.quantity, 0);
      return quantity === 0 ? product : {
        ...product,
        stock: product.stock === 999 ? 999 : Math.max(0, product.stock - quantity),
        stockHistory: (product.stockHistory || []).filter((movement) => !matches(movement)),
      };
    }));
    p.setPurchaseInvoices((current: PurchaseInvoice[]) => current.filter((item) => item.id !== invoice.id));
    p.setCosts((current: Cost[]) => current.filter((cost) => cost.sourceInvoiceId !== invoice.id));
    p.notify(`Inkoopfactuur afgeboekt en ${reversedQuantity} voorraadstuks teruggedraaid`);
  };
  return (
    <>
      <PageHead title="Inkoopfacturen" desc="Geüploade facturen van leveranciers" action="Factuur uploaden" onAction={() => p.setModal("invoice-import")} />
      <div className="card table-card purchase-invoice-table">
        <table>
          <thead><tr><th>Factuurnummer</th><th>Leverancier</th><th>Datum</th><th>Bedrag</th></tr></thead>
          <tbody>
            {rows.map((invoice: PurchaseInvoice) => (
              <tr key={invoice.id}>
                <td><button className="invoice-file-button" onClick={() => openInvoice(invoice)}><b>{invoice.number || invoice.fileName}</b><small>Bekijk factuur</small></button></td>
                <td>{invoice.supplier || "Onbekende leverancier"}</td>
                <td>{invoice.date ? dateNL(invoice.date) : "Datum onbekend"}</td>
                <td><b>{invoice.currency} {invoice.total.toFixed(2)}</b><button className="invoice-writeoff-link" onClick={() => writeOff(invoice)}>Afboeken</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <Empty text="Nog geen inkoopfacturen geüpload" />}
      </div>
    </>
  );
}
function DocTable({ type, rows, actions }: any) {
  return (
    <div className="card table-card">
      <table>
        <thead>
          <tr>
            <th>{type === "factuur" ? "Factuurnummer" : "Offertenummer"}</th>
            <th>Klant</th>
            <th>Datum</th>
            <th>{type === "factuur" ? "Vervaldatum" : "Geldig tot"}</th>
            <th>Bedrag</th>
            <th>Status</th>
            <th>Acties</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r: any) => (
            <tr key={r.id}>
              <td>
                <b>{r.number}</b>
              </td>
              <td>{r.customer}</td>
              <td>{dateNL(r.date)}</td>
              <td>{dateNL(r.due || r.valid)}</td>
              <td>
                <b>{euro(r.total)}</b>
                {r.paid > 0 && r.paid < r.total && (
                  <small>{euro(r.total - r.paid)} open</small>
                )}
              </td>
              <td>
                <Badge>{r.status}</Badge>
              </td>
              <td>
                <div className="row-actions">{actions(r)}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Payments(p: any) {
  return (
    <>
      <PageHead
        title="Betalingen"
        desc="Registreer en controleer ontvangen bedragen"
      />
      <div className="card table-card">
        <table>
          <thead>
            <tr>
              <th>Factuur</th>
              <th>Klant</th>
              <th>Totaal</th>
              <th>Betaald</th>
              <th>Openstaand</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {p.invoices.map((i: Invoice) => (
              <tr key={i.id}>
                <td>
                  <b>{i.number}</b>
                </td>
                <td>{i.customer}</td>
                <td>{euro(i.total)}</td>
                <td>{euro(i.paid)}</td>
                <td>
                  <b>{euro(i.total - i.paid)}</b>
                </td>
                <td>
                  <Badge>{i.status}</Badge>
                </td>
                <td>
                  {i.paid < i.total && (
                    <button
                      className="table-btn"
                      onClick={() => p.setModal(`payment:${i.id}`)}
                    >
                      Betaling registreren
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
function Costs(p: any) {
  const rows = p.costs.filter((c: Cost) =>
    [c.supplier, c.category, c.description].some((s) =>
      s.toLowerCase().includes(p.query.toLowerCase()),
    ),
  );
  return (
    <>
      <PageHead
        title="Zakelijke kosten"
        desc="Houd inkopen en overige uitgaven bij"
        action="Nieuwe uitgave"
        onAction={() => p.setModal("cost")}
      />
      <div className="mini-kpis">
        <div>
          <span>Kosten deze maand</span>
          <b>{euro(rows.reduce((a: number, c: Cost) => a + c.amount, 0))}</b>
        </div>
        <div>
          <span>Openstaand</span>
          <b>{euro(0)}</b>
        </div>
        <div>
          <span>Bonnen verwerkt</span>
          <b>{rows.length}</b>
        </div>
      </div>
      <div className="card table-card">
        <table>
          <thead>
            <tr>
              <th>Leverancier</th>
              <th>Datum</th>
              <th>Categorie</th>
              <th>Omschrijving</th>
              <th>Valuta</th>
              <th>Bedrag</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c: Cost) => (
              <tr key={c.id}>
                <td>
                  <b>{c.supplier}</b>
                </td>
                <td>{dateNL(c.date)}</td>
                <td>{c.category}</td>
                <td>{c.description}</td>
                <td>{c.originalAmount!=null?`${c.originalAmount.toLocaleString("nl-NL")} ${c.currency}`:c.currency}<small>{c.exchangeRate?`Koers ${c.exchangeRate}`:""}</small></td>
                <td>
                  <b>{euro(c.amount)}</b><small>Omgerekend</small>
                </td>
                <td>
                  <Badge>{c.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
function Reports(p: any) {
  const profit = p.totalRevenue - p.costTotal;
  return (
    <>
      <PageHead
        title="Omzet & winst"
        desc="Inzicht in de financiële ontwikkeling van je bedrijf"
      />
      <div className="report-head">
        <div className="segment">
          <button>Week</button>
          <button className="active">Maand</button>
          <button>Kwartaal</button>
          <button>Jaar</button>
        </div>
        <div>
          <button className="secondary">CSV</button>
          <button className="secondary">Excel</button>
          <button className="primary">PDF-overzicht</button>
        </div>
      </div>
      <div className="report-grid">
        <div className="hero-metric">
          <span>Totale omzet</span>
          <b>{euro(p.totalRevenue)}</b>
          <small>Op basis van je eigen facturen</small>
        </div>
        <div className="hero-metric">
          <span>Totale kosten</span>
          <b>{euro(p.costTotal)}</b>
          <small>Inkoop en overige kosten</small>
        </div>
        <div className="hero-metric green">
          <span>Geschatte brutowinst</span>
          <b>{euro(profit)}</b>
          <small>
            {p.totalRevenue?Math.round((profit / p.totalRevenue) * 100):0}% brutomarge
          </small>
        </div>
      </div>
      <div className="grid-2">
        <div className="card chart-card">
          <div className="card-head">
            <div>
              <h2>Omzet en kosten</h2>
              <p>Per maand in 2026</p>
            </div>
          </div>
          {p.invoices.length?<Chart period="Jaar" invoices={p.invoices}/>:<Empty text="Voeg facturen toe om dit overzicht te vullen"/>}
        </div>
        <div className="card">
          <div className="card-head">
            <div>
              <h2>Verdeling per product</h2>
              <p>Omzetaandeel</p>
            </div>
          </div>
          {p.products.length?<div className="rank">{p.products.slice(0,5).map((product:Product,index:number)=><div key={product.id}><span>{index+1}</span><div><b>{product.name}</b><small>{product.stock} op voorraad</small></div><strong>{euro(product.price)}</strong></div>)}</div>:<Empty text="Voeg producten toe om dit overzicht te vullen"/>}
        </div>
      </div>
      <p className="disclaimer">
        ℹ Dit overzicht is een hulpmiddel. Raadpleeg je boekhouder voor je
        officiële administratie en belastingaangifte.
      </p>
    </>
  );
}
function Settings({ notify }: any) {
  const [activeSection, setActiveSection] = useState("Bedrijfsgegevens");
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [passkeyMessage, setPasskeyMessage] = useState("");
  const registerPasskey = async () => {
    if (!("PublicKeyCredential" in window)) {
      setPasskeyMessage("Deze browser ondersteunt geen passkeys.");
      return;
    }
    setPasskeyBusy(true);
    setPasskeyMessage("");
    const { error } = await supabase.auth.registerPasskey();
    setPasskeyMessage(
      error
        ? error.code === "passkey_disabled"
          ? "Schakel passkeys eerst in via Supabase Authentication → Passkeys."
          : "Koppelen is niet gelukt of geannuleerd. Probeer het opnieuw."
        : "Passkey is gekoppeld. Je kunt deze voortaan gebruiken bij het inloggen.",
    );
    setPasskeyBusy(false);
  };
  return (
    <>
      <PageHead
        title="Bedrijfsinstellingen"
        desc="Deze gegevens worden automatisch gebruikt op offertes en facturen"
      />
      <div className="settings-layout">
        <div className="settings-nav">
          {["Bedrijfsgegevens", "Facturatie", "Nummering", "Documentteksten", "Back-up & export", "Wijzigingslogboek"].map((section) => (
            <button key={section} type="button" className={activeSection === section ? "active" : ""} onClick={() => setActiveSection(section)}>{section}</button>
          ))}
        </div>
        <form
          className="card settings"
          onSubmit={(e) => {
            e.preventDefault();
            notify("Instellingen veilig opgeslagen");
          }}
        >
          <h2>{activeSection}</h2>
          <p>{activeSection === "Bedrijfsgegevens" ? "Basisinformatie voor je documenten en communicatie." : `Beheer hier je instellingen voor ${activeSection.toLowerCase()}.`}</p>
          {activeSection === "Bedrijfsgegevens" ? <>
          <div className="form-grid">
            <label>
              Bedrijfsnaam
              <input placeholder="Vul je bedrijfsnaam in" />
            </label>
            <label>
              Handelsnaam
              <input placeholder="Vul je handelsnaam in" />
            </label>
            <label>
              Adres
              <input placeholder="Straat en huisnummer" />
            </label>
            <label>
              Postcode en plaats
              <input placeholder="Postcode en plaats" />
            </label>
            <label>
              E-mailadres
              <input type="email" placeholder="jij@jouwbedrijf.nl" />
            </label>
            <label>
              Telefoonnummer
              <input placeholder="Telefoonnummer" />
            </label>
            <label>
              KvK-nummer
              <input placeholder="KvK-nummer" />
            </label>
            <label>
              IBAN
              <input placeholder="NL00 BANK 0000 0000 00" />
            </label>
            <label>
              Standaard betaaltermijn
              <select defaultValue="14">
                <option>7</option>
                <option>14</option>
                <option>30</option>
              </select>
            </label>
            <label className="toggle-label">
              Btw berekenen <input type="checkbox" defaultChecked />
              <span className="toggle" />
            </label>
          </div>
          <label>
            Tekst voor factuur zonder btw
            <textarea defaultValue="Op deze factuur wordt geen btw berekend." />
          </label>
          </> : activeSection === "Facturatie" ? <div className="form-grid"><label>Standaard betaaltermijn<select defaultValue="14"><option>7 dagen</option><option value="14">14 dagen</option><option>30 dagen</option></select></label><label className="toggle-label">Btw berekenen <input type="checkbox" defaultChecked /><span className="toggle" /></label></div> : activeSection === "Nummering" ? <div className="form-grid"><label>Voorvoegsel facturen<input defaultValue="FAC" /></label><label>Volgend factuurnummer<input type="number" min="1" defaultValue="1" /></label></div> : activeSection === "Documentteksten" ? <label>Standaardtekst onder facturen<textarea defaultValue="Bedankt voor je aankoop." /></label> : activeSection === "Back-up & export" ? <div className="settings-placeholder"><p>Download een kopie van je administratie.</p><button type="button" className="secondary" onClick={() => notify("Volledige back-up gedownload")}>⇩ Back-up maken</button></div> : <div className="settings-placeholder"><p>Nog geen wijzigingen geregistreerd.</p></div>}
          <section className="security-settings">
            <div>
              <h2>Passkeys</h2>
              <p>Koppel dit apparaat om voortaan veilig zonder wachtwoord in te loggen.</p>
            </div>
            <button type="button" className="secondary" disabled={passkeyBusy} onClick={registerPasskey}>
              ◉ {passkeyBusy ? "Koppelen…" : "Passkey koppelen"}
            </button>
            {passkeyMessage && <div className="auth-message">{passkeyMessage}</div>}
          </section>
          <div className="form-actions">
            <button
              type="button"
              className="secondary"
              onClick={() => notify("Volledige back-up gedownload")}
            >
              ⇩ Back-up maken
            </button>
            <button className="primary">Wijzigingen opslaan</button>
          </div>
        </form>
      </div>
    </>
  );
}

function Modal(p: any) {
  const [orderQty, setOrderQty] = useState(0);
  const [orderTotal, setOrderTotal] = useState(0);
  const [costCurrency, setCostCurrency] = useState("EUR");
  const [costOriginal, setCostOriginal] = useState(0);
  const [costRate, setCostRate] = useState(1);
  const [saleCustomerId, setSaleCustomerId] = useState(String(p.selected?.id || "new"));
  const [saleProductId, setSaleProductId] = useState(Number(p.products?.[0]?.id || 0));
  const type = p.type.split(":")[0];
  const recordId = Number(p.type.split(":")[1]);
  const close = p.close;
  const calculatedUnitCost =
    orderQty > 0 ? Math.round((orderTotal / orderQty) * 100) / 100 : 0;
  const convertedCost = Math.round(costOriginal * costRate * 100) / 100;
  if (type === "invoice-import") return <InvoiceImportModal {...p} close={close} />;
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (type === "sale") {
      const existingCustomer = p.customers.find((customer: Customer) => customer.id === Number(saleCustomerId));
      const customerId = existingCustomer?.id || Date.now();
      const customer = existingCustomer || {
        id: customerId,
        company: String(f.get("company")),
        contact: String(f.get("contact")),
        email: String(f.get("email")),
        phone: String(f.get("phone")),
        city: String(f.get("city")),
        branch: "Anders",
        status: "Klant",
        revenue: 0,
        purchases: 0,
        lastOrder: "",
        nextFollow: "",
        note: "",
      };
      const product = p.products.find((item: Product) => item.id === saleProductId);
      const quantity = Math.max(1, Math.floor(Number(f.get("quantity"))));
      if (!product || (product.stock !== 999 && product.stock < quantity)) {
        p.notify("Onvoldoende voorraad voor deze verkoop");
        return;
      }
      const vatRate = product.vatRate ?? 21;
      const unitPriceInclVat = product.priceIncludesVat === false
        ? Math.round(product.price * (1 + vatRate / 100) * 100) / 100
        : product.price;
      const total = Math.round(unitPriceInclVat * quantity * 100) / 100;
      const subtotal = Math.round((total / (1 + vatRate / 100)) * 100) / 100;
      const vatAmount = Math.round((total - subtotal) * 100) / 100;
      const invoiceNumber = `FAC-${new Date().getFullYear()}-${String(p.invoices.length + 1).padStart(4, "0")}`;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 14);
      const invoice: Invoice = {
        id: Date.now(), number: invoiceNumber, customer: customer.company, customerEmail: customer.email,
        date: today, due: dueDate.toISOString().slice(0, 10), total, subtotal, vatAmount, vatRate, paid: 0, status: "Verzonden",
        lines: [{ productId: product.id, description: product.name, quantity, unitPrice: unitPriceInclVat, total }],
      };
      p.setInvoices((current: Invoice[]) => [invoice, ...current]);
      p.setProducts((current: Product[]) => current.map((item) => item.id === product.id && item.stock !== 999 ? {
        ...item,
        stock: item.stock - quantity,
        stockHistory: [...(item.stockHistory || []), { id: Date.now(), date: today, type: "afboeking", quantity, reason: `Verkoop ${invoiceNumber}` }],
      } : item));
      p.setCustomers((current: Customer[]) => {
        const updated = current.map((item) => item.id === customerId ? { ...item, revenue: item.revenue + total, purchases: item.purchases + 1, lastOrder: today, status: "Klant" } : item);
        return existingCustomer ? updated : [{ ...customer, revenue: total, purchases: 1, lastOrder: today }, ...updated];
      });
      const pdf = await createInvoicePdf({ number: invoice.number, date: invoice.date, due: invoice.due, customer: { company: customer.company, contact: customer.contact, email: customer.email, city: customer.city }, lines: invoice.lines || [], total: invoice.total, subtotal, vatAmount, vatRate });
      downloadInvoicePdf(pdf, invoice.number);
      p.notify(`${invoiceNumber}.pdf aangemaakt en voorraad bijgewerkt`);
      if (customer.email) {
        const subject = encodeURIComponent(`Factuur ${invoiceNumber}`);
        const body = encodeURIComponent(`Beste ${customer.contact || customer.company},\n\nIn de bijlage vind je factuur ${invoiceNumber}. Het PDF-bestand is zojuist gedownload en kan aan deze e-mail worden toegevoegd.\n\nMet vriendelijke groet,\nWGMN Digital`);
        setTimeout(() => { window.location.href = `mailto:${encodeURIComponent(customer.email)}?subject=${subject}&body=${body}`; }, 100);
      }
    }
    if (type === "customer") {
      p.setCustomers((a: Customer[]) => [
        ...a,
        {
          id: Date.now(),
          company: String(f.get("company")),
          contact: String(f.get("contact")),
          email: String(f.get("email")),
          phone: String(f.get("phone")),
          city: String(f.get("city")),
          branch: String(f.get("branch")),
          status: "Prospect",
          revenue: 0,
          purchases: 0,
          lastOrder: "",
          nextFollow: String(f.get("follow") || today),
          note: String(f.get("note") || ""),
        },
      ]);
      p.notify("Klant toegevoegd");
    }
    if (type === "product") {
      const qty = Number(f.get("orderedQty"));
      const total = Number(f.get("purchaseTotal"));
      const cost = qty > 0 ? Math.round((total / qty) * 100) / 100 : 0;
      p.setProducts((a: Product[]) => [
        ...a,
        {
          id: Date.now(),
          name: String(f.get("name")),
          sku: String(f.get("sku")),
          category: String(f.get("category")),
          cost,
          price: Number(f.get("price")),
          priceIncludesVat: f.get("priceIncludesVat") === "on",
          vatRate: 21,
          stock: qty,
          min: Number(f.get("min")),
          active: true,
          lastPurchaseQty: qty,
          lastPurchaseTotal: total,
          stockInitialized: true,
          supplier: String(f.get("supplier") || ""),
        },
      ]);
      p.notify(`Product toegevoegd — kostprijs ${euro(cost)} per stuk`);
    }
    if (type === "stock-order") {
      const qty = Number(f.get("orderedQty"));
      const total = Number(f.get("purchaseTotal"));
      const cost = qty > 0 ? Math.round((total / qty) * 100) / 100 : 0;
      p.setProducts((a: Product[]) =>
        a.map((x) =>
          x.id === recordId
            ? {
                ...x,
                stock: x.stock + qty,
                cost,
                lastPurchaseQty: qty,
                lastPurchaseTotal: total,
                stockInitialized: true,
                supplier: String(f.get("supplier") || x.supplier || ""),
              }
            : x,
        ),
      );
      p.notify(
        `${qty} stuks toegevoegd — nieuwe kostprijs ${euro(cost)} per stuk`,
      );
    }
    if (type === "stock-writeoff") {
      const product = p.products.find((x: Product) => x.id === recordId);
      const qty = Math.max(0, Math.floor(Number(f.get("quantity"))));
      if (!product || qty < 1 || qty > product.stock) return;
      const reason = String(f.get("reason") || "Handmatige correctie");
      p.setProducts((a: Product[]) =>
        a.map((x) =>
          x.id === recordId
            ? {
                ...x,
                stock: x.stock - qty,
                stockHistory: [
                  ...(x.stockHistory || []),
                  { id: Date.now(), date: today, type: "afboeking", quantity: qty, reason },
                ],
              }
            : x,
        ),
      );
      p.notify(`${qty} stuks afgeboekt van ${product.name}`);
    }
    if (type === "product-price") {
      const price = Math.max(0, Number(f.get("price")));
      const name = String(f.get("name")).trim();
      const priceIncludesVat = f.get("priceIncludesVat") === "on";
      p.setProducts((current: Product[]) => current.map((product) => product.id === recordId ? { ...product, name, price, priceIncludesVat, vatRate: 21 } : product));
      p.notify(`${name} bijgewerkt — ${euro(price)} ${priceIncludesVat ? "incl." : "excl."} btw`);
    }
    if (type === "cost") {
      p.setCosts((a: Cost[]) => [
        {
          id: Date.now(),
          supplier: String(f.get("supplier")),
          date: String(f.get("date")),
          category: String(f.get("category")),
          description: String(f.get("description")),
          amount: convertedCost,
          currency: costCurrency.toUpperCase(),
          originalAmount: costOriginal,
          exchangeRate: costRate,
          status: "Betaald",
        },
        ...a,
      ]);
      p.notify(`Uitgave opgeslagen als ${euro(convertedCost)}`);
    }
    if (type === "payment") {
      const amount = Number(f.get("amount"));
      p.setInvoices((a: Invoice[]) =>
        a.map((i) =>
          i.id === recordId
            ? {
                ...i,
                paid: Math.min(i.total, i.paid + amount),
                status:
                  i.paid + amount >= i.total
                    ? "Betaald"
                    : "Gedeeltelijk betaald",
              }
            : i,
        ),
      );
      p.notify("Betaling geregistreerd en factuur bijgewerkt");
    }
    if (type === "quote" || type === "invoice") {
      const customer = String(f.get("customer"));
      const total = Number(f.get("qty")) * Number(f.get("price"));
      if (type === "quote") {
        const n = p.quotes.length + 28;
        p.setQuotes((a: Quote[]) => [
          {
            id: Date.now(),
            number: `OFF-2026-${String(n).padStart(4, "0")}`,
            customer,
            date: today,
            valid: String(f.get("due")),
            total,
            status: "Concept",
          },
          ...a,
        ]);
        p.notify("Offerte als concept opgeslagen");
      } else {
        const n = p.invoices.length + 43;
        p.setInvoices((a: Invoice[]) => [
          {
            id: Date.now(),
            number: `FAC-2026-${String(n).padStart(4, "0")}`,
            customer,
            date: today,
            due: String(f.get("due")),
            total,
            paid: 0,
            status: "Concept",
          },
          ...a,
        ]);
        const product = p.products.find(
          (x: Product) => x.name === String(f.get("product")),
        );
        if (product && product.stock !== 999)
          p.setProducts((a: Product[]) =>
            a.map((x) =>
              x.id === product.id
                ? { ...x, stock: Math.max(0, x.stock - Number(f.get("qty"))) }
                : x,
            ),
          );
        p.notify("Factuur aangemaakt en voorraad bijgewerkt");
      }
    }
    if (type === "contact") {
      p.notify("Contactmoment opgeslagen en opvolging gepland");
    }
    close();
  };
  if (type === "quick")
    return (
      <div
        className="modal-wrap"
        onMouseDown={(e) => e.target === e.currentTarget && close()}
      >
        <div className="modal quick-modal">
          <button className="modal-close" onClick={close}>
            ×
          </button>
          <h2>Wat wil je toevoegen?</h2>
          <p>Kies een snelle invoer.</p>
          <div className="quick-grid">
            {[
              ["customer", "♙", "Nieuwe klant"],
              ["sale", "▤", "Nieuwe verkoop"],
              ["quote", "◇", "Nieuwe offerte"],
              ["cost", "↘", "Nieuwe uitgave"],
              ["contact", "⌁", "Contactmoment"],
              ["product", "□", "Nieuw product"],
            ].map((x) => (
              <button
                key={x[0]}
                onClick={() => {
                  close();
                  setTimeout(() => p.setModal?.(x[0]), 0);
                }}
              >
                <span>{x[1]}</span>
                {x[2]}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  if (type === "customer-detail" && p.selected)
    return (
      <div
        className="modal-wrap"
        onMouseDown={(e) => e.target === e.currentTarget && close()}
      >
        <div className="modal detail">
          <button className="modal-close" onClick={close}>
            ×
          </button>
          <div className="customer-hero">
            <div className="avatar large">
              {p.selected.company.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h2>{p.selected.company}</h2>
              <p>
                {p.selected.contact} · {p.selected.branch}
              </p>
              <Badge>{p.selected.status}</Badge>
            </div>
          </div>
          <div className="detail-actions">
            <button>＋ Nieuwe offerte</button>
            <button onClick={() => p.setModal("sale")}>＋ Nieuwe verkoop</button>
            <button>＋ Factuur</button>
            <button
              className="delete-customer-button"
              onClick={() => {
                if (!window.confirm(`Klant ${p.selected.company} definitief verwijderen?`)) return;
                p.setCustomers((current: Customer[]) =>
                  current.filter((customer) => customer.id !== p.selected.id),
                );
                p.notify("Klant verwijderd");
                close();
              }}
            >
              Klant verwijderen
            </button>
          </div>
          <div className="detail-metrics">
            <div>
              <small>Totale omzet</small>
              <b>{euro(p.selected.revenue)}</b>
            </div>
            <div>
              <small>Aankopen</small>
              <b>{p.selected.purchases}</b>
            </div>
            <div>
              <small>Gem. bestelwaarde</small>
              <b>
                {euro(
                  p.selected.purchases
                    ? p.selected.revenue / p.selected.purchases
                    : 0,
                )}
              </b>
            </div>
            <div>
              <small>Openstaand</small>
              <b>
                {euro(
                  p.invoices
                    .filter((i: Invoice) => i.customer === p.selected.company)
                    .reduce((a: number, i: Invoice) => a + i.total - i.paid, 0),
                )}
              </b>
            </div>
          </div>
          <div className="detail-grid">
            <div>
              <h3>Contactgegevens</h3>
              <p>✉ {p.selected.email}</p>
              <p>☎ {p.selected.phone}</p>
              <p>⌖ {p.selected.city}, Nederland</p>
            </div>
            <div>
              <h3>Interne notitie</h3>
              <p>{p.selected.note || "Nog geen interne notitie."}</p>
              <button className="link">Notitie bewerken</button>
            </div>
          </div>
          <h3>Contactgeschiedenis</h3>
          <div className="empty-contact-history">Nog geen contactmomenten geregistreerd.</div>
        </div>
      </div>
    );
  const titles: any = {
    customer: "Nieuwe klant",
    product: "Product toevoegen",
    cost: "Nieuwe uitgave",
    quote: "Nieuwe offerte",
    invoice: "Nieuwe factuur",
    sale: "Nieuwe verkoop",
    payment: "Betaling registreren",
    contact: "Contactmoment toevoegen",
    "stock-order": "Inkoop registreren",
    "stock-writeoff": "Voorraad afboeken",
    "product-price": "Product en prijs bewerken",
  };
  return (
    <div
      className="modal-wrap"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <form className="modal" onSubmit={submit}>
        <button type="button" className="modal-close" onClick={close}>
          ×
        </button>
        <h2>{titles[type]}</h2>
        <p>
          {type === "product"
            ? "Vul je product en eerste inkoop in. De kostprijs per stuk rekenen we voor je uit."
            : type === "stock-order"
              ? "Vul het bestelde aantal en het totale inkoopbedrag in."
              : "Vul de gegevens hieronder in. Velden met * zijn verplicht."}
        </p>
        {type === "customer" && (
          <div className="form-grid">
            <label>
              Bedrijfsnaam *<input name="company" required autoFocus />
            </label>
            <label>
              Contactpersoon *<input name="contact" required />
            </label>
            <label>
              E-mailadres
              <input type="email" name="email" />
            </label>
            <label>
              Telefoonnummer
              <input name="phone" />
            </label>
            <label>
              Plaats
              <input name="city" />
            </label>
            <label>
              Branche
              <select name="branch">
                <option>Restaurant</option>
                <option>Café</option>
                <option>Kapsalon</option>
                <option>Schoonheidssalon</option>
                <option>Zonnestudio</option>
                <option>Anders</option>
              </select>
            </label>
            <label>
              Opvolgdatum
              <input name="follow" type="date" defaultValue={today} />
            </label>
            <label className="full">
              Interne notitie
              <textarea name="note" />
            </label>
          </div>
        )}
        {type === "sale" && (
          <>
            <div className="form-section-title"><span>1</span><div><b>Klantgegevens</b><small>Kies een klant of maak direct een nieuwe aan.</small></div></div>
            <div className="form-grid">
              <label className="full">Klant<select value={saleCustomerId} onChange={(event) => setSaleCustomerId(event.target.value)}><option value="new">＋ Nieuwe klant</option>{p.customers.map((customer: Customer) => <option key={customer.id} value={customer.id}>{customer.company}</option>)}</select></label>
              {saleCustomerId === "new" && <><label>Bedrijfsnaam of naam *<input name="company" required autoFocus /></label><label>Contactpersoon<input name="contact" /></label><label>E-mailadres *<input name="email" type="email" required /></label><label>Telefoonnummer<input name="phone" /></label><label>Plaats<input name="city" /></label></>}
            </div>
            <div className="form-section-title"><span>2</span><div><b>Verkoop</b><small>Kies het product en aantal.</small></div></div>
            <div className="form-grid">
              <label>Product *<select value={saleProductId} onChange={(event) => setSaleProductId(Number(event.target.value))} required>{p.products.map((product: Product) => <option key={product.id} value={product.id}>{product.name} · {product.stock === 999 ? "onbeperkt" : `${product.stock} op voorraad`}</option>)}</select></label>
              <label>Aantal *<input name="quantity" type="number" min="1" defaultValue="1" required /></label>
              <label>Prijs per stuk incl. btw<input value={(() => { const product = p.products.find((item: Product) => item.id === saleProductId); if (!product) return 0; return product.priceIncludesVat === false ? (product.price * (1 + (product.vatRate ?? 21) / 100)).toFixed(2) : product.price; })()} readOnly /></label>
            </div>
            <div className="privacy-note">Na opslaan wordt de factuur aangemaakt, de voorraad afgeboekt en een verzendklare e-mail geopend.</div>
          </>
        )}
        {type === "product" && (
          <>
            <div className="form-section-title">
              <span>1</span>
              <div>
                <b>Productgegevens</b>
                <small>Wat voeg je toe aan je assortiment?</small>
              </div>
            </div>
            <div className="form-grid">
              <label>
                Productnaam *
                <input
                  name="name"
                  required
                  autoFocus
                  placeholder="Bijv. NFC-tafelstandaard"
                />
              </label>
              <label>
                Artikelnummer / SKU *
                <input name="sku" required placeholder="Bijv. NFC-STD-02" />
              </label>
              <label>
                Categorie
                <select name="category">
                  <option>NFC</option>
                  <option>QR</option>
                  <option>Service</option>
                  <option>Overig</option>
                </select>
              </label>
              <label>
                Verkoopprijs per stuk *
                <input
                  name="price"
                  type="number"
                  min="0"
                  step=".01"
                  required
                  placeholder="0,00"
                />
              </label>
              <label className="toggle-label">
                Prijs is incl. btw
                <input name="priceIncludesVat" type="checkbox" defaultChecked />
                <span className="toggle" />
              </label>
              <label>
                Minimale voorraad
                <input name="min" type="number" min="0" defaultValue="5" />
              </label>
            </div>
            <div className="form-section-title">
              <span>2</span>
              <div>
                <b>Eerste inkoop</b>
                <small>Hiermee berekenen we automatisch je kostprijs.</small>
              </div>
            </div>
            <PurchaseFields
              {...{
                orderQty,
                setOrderQty,
                orderTotal,
                setOrderTotal,
                calculatedUnitCost,
              }}
            />
          </>
        )}
        {type === "stock-order" && (
          <>
            <div className="selected-product">
              <span>Product</span>
              <b>{p.products.find((x: Product) => x.id === recordId)?.name}</b>
              <small>
                Huidige voorraad:{" "}
                {p.products.find((x: Product) => x.id === recordId)?.stock}{" "}
                stuks
              </small>
            </div>
            <PurchaseFields
              {...{
                orderQty,
                setOrderQty,
                orderTotal,
                setOrderTotal,
                calculatedUnitCost,
              }}
            />
          </>
        )}
        {type === "stock-writeoff" && (
          <>
            <div className="selected-product">
              <span>Product</span>
              <b>{p.products.find((x: Product) => x.id === recordId)?.name}</b>
              <small>Beschikbaar: {p.products.find((x: Product) => x.id === recordId)?.stock} stuks</small>
            </div>
            <div className="form-grid">
              <label>
                Aantal afboeken *
                <input name="quantity" type="number" min="1" max={p.products.find((x: Product) => x.id === recordId)?.stock || 1} required autoFocus />
              </label>
              <label>
                Reden *
                <select name="reason" required>
                  <option>Verkocht</option>
                  <option>Beschadigd</option>
                  <option>Vermist</option>
                  <option>Eigen gebruik</option>
                  <option>Voorraadcorrectie</option>
                </select>
              </label>
            </div>
          </>
        )}
        {type === "product-price" && (
          <div className="form-grid">
            <label className="full">Productnaam *<input name="name" defaultValue={p.products.find((product: Product) => product.id === recordId)?.name || ""} required autoFocus /></label>
            <label>Verkoopprijs per stuk *<input name="price" type="number" min="0" step=".01" defaultValue={p.products.find((product: Product) => product.id === recordId)?.price || 0} required /></label>
            <label className="toggle-label">Prijs is incl. btw<input name="priceIncludesVat" type="checkbox" defaultChecked={p.products.find((product: Product) => product.id === recordId)?.priceIncludesVat !== false} /><span className="toggle" /></label>
            <div className="privacy-note full">Op verkoopfacturen wordt altijd 21% btw apart vermeld.</div>
          </div>
        )}
        {type === "cost" && (
          <>
            <div className="form-grid">
              <label>
                Leverancier *<input name="supplier" required autoFocus />
              </label>
              <label>
                Datum
                <input name="date" type="date" defaultValue={today} />
              </label>
              <label>
                Categorie
                <select name="category">
                  <option>Inkoop voorraad</option>
                  <option>Verzendkosten</option>
                  <option>Software</option>
                  <option>Marketing</option>
                  <option>Reiskosten</option>
                  <option>Overig</option>
                </select>
              </label>
              <label>
                Valutacode *
                <input list="valutacodes" value={costCurrency} onChange={(e)=>{const value=e.target.value.toUpperCase();setCostCurrency(value);if(value==="EUR")setCostRate(1)}} maxLength={3} required />
                <datalist id="valutacodes"><option value="EUR"/><option value="USD"/><option value="GBP"/><option value="CNY"/><option value="CHF"/><option value="TRY"/><option value="CAD"/><option value="AUD"/></datalist>
              </label>
              <label>
                Bedrag in {costCurrency || "valuta"} *
                <input type="number" min="0" step=".01" value={costOriginal||""} onChange={(e)=>setCostOriginal(Number(e.target.value))} required placeholder="0,00" />
              </label>
              <label>
                1 {costCurrency || "valuta"} is hoeveel euro? *
                <input type="number" min="0.000001" step=".000001" value={costRate} onChange={(e)=>setCostRate(Number(e.target.value))} required />
                <small className="field-help">Voorbeeld: bij USD kan dit 0,92 zijn.</small>
              </label>
              <label className="full">
                Omschrijving
                <input name="description" required />
              </label>
            </div>
            <div className={`cost-result ${convertedCost?"ready":""}`}><div><small>AUTOMATISCH OMGEREKEND</small><b>Bedrag dat in je administratie komt</b><span>{costOriginal||0} {costCurrency} × {costRate||0}</span></div><strong>{euro(convertedCost)}</strong></div>
          </>
        )}
        {(type === "quote" || type === "invoice") && (
          <>
            <div className="form-grid">
              <label>
                Klant
                <select name="customer">
                  {p.customers.map((c: Customer) => (
                    <option key={c.id}>{c.company}</option>
                  ))}
                </select>
              </label>
              <label>
                {type === "quote" ? "Geldig tot" : "Uiterste betaaldatum"}
                <input name="due" type="date" defaultValue="2026-08-08" />
              </label>
              <label>
                Product
                <select name="product">
                  {p.products.map((x: Product) => (
                    <option key={x.id}>{x.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Aantal
                <input name="qty" type="number" min="1" defaultValue="1" />
              </label>
              <label>
                Prijs per stuk
                <input
                  name="price"
                  type="number"
                  step=".01"
                  defaultValue="39.95"
                />
              </label>
              <label>
                Korting %
                <input type="number" min="0" max="100" defaultValue="0" />
              </label>
            </div>
            <div className="calc-preview">
              <span>Subtotaal</span>
              <b>{euro(39.95)}</b>
              <span>Btw (21%)</span>
              <b>{euro(8.39)}</b>
              <strong>Totaal</strong>
              <strong>{euro(48.34)}</strong>
            </div>
          </>
        )}
        {type === "payment" && (
          <div className="form-grid">
            <label>
              Betaald bedrag *
              <input
                name="amount"
                type="number"
                step=".01"
                required
                autoFocus
              />
            </label>
            <label>
              Betaaldatum
              <input type="date" defaultValue={today} />
            </label>
            <label>
              Betaalmethode
              <select>
                <option>Bankoverschrijving</option>
                <option>Contant</option>
                <option>Betaalverzoek</option>
                <option>Pin</option>
                <option>iDEAL</option>
                <option>Anders</option>
              </select>
            </label>
            <label>
              Bankreferentie
              <input />
            </label>
          </div>
        )}
        {type === "contact" && (
          <div className="form-grid">
            <label>
              Klant
              <select>
                {p.customers.map((c: Customer) => (
                  <option key={c.id}>{c.company}</option>
                ))}
              </select>
            </label>
            <label>
              Contacttype
              <select>
                <option>Telefonisch gesproken</option>
                <option>Langs geweest</option>
                <option>WhatsApp gestuurd</option>
                <option>E-mail gestuurd</option>
                <option>Offerte verzonden</option>
              </select>
            </label>
            <label>
              Datum
              <input type="date" defaultValue={today} />
            </label>
            <label>
              Opvolgdatum
              <input type="date" defaultValue="2026-07-30" />
            </label>
            <label className="full">
              Notitie
              <textarea required />
            </label>
          </div>
        )}
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={close}>
            Annuleren
          </button>
          <button className="primary">
            {type === "stock-order" ? "Inkoop opslaan" : type === "stock-writeoff" ? "Voorraad afboeken" : type === "sale" ? "Factuur maken en verzenden" : "Opslaan"}
          </button>
        </div>
      </form>
    </div>
  );
}

function InvoiceImportModal(p: any) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [parsed, setParsed] = useState<ParsedInvoice | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [invoiceExchangeRate, setInvoiceExchangeRate] = useState(1);
  const parsedItemsSubtotal = parsed?.items.reduce((sum, item) => sum + item.lineTotal, 0) || 0;
  const displayedUnitCost = (item: ParsedInvoice["items"][number]) => {
    const shippingShare = parsedItemsSubtotal > 0
      ? (parsed?.shippingFee || 0) * (item.lineTotal / parsedItemsSubtotal)
      : (parsed?.shippingFee || 0) / Math.max(1, parsed?.items.length || 1);
    return Math.round(((item.lineTotal + shippingShare) / item.quantity) * 100) / 100;
  };

  const analyse = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const file = form.get("invoice");
    if (!(file instanceof File) || !file.size) {
      setError("Kies eerst een PDF-, JPG- of PNG-factuur.");
      setBusy(false);
      return;
    }
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setError("Je sessie is verlopen. Log opnieuw in.");
      setBusy(false);
      return;
    }
    try {
      const response = await fetch("/api/invoices/parse", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Factuur kon niet worden gelezen.");
      setParsed(result);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Factuur kon niet worden gelezen.");
    } finally {
      setBusy(false);
    }
  };

  const applyInventory = async () => {
    if (!parsed || !selectedFile) return;
    setBusy(true);
    setError("");
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) {
      setError("Je sessie is verlopen. Log opnieuw in.");
      setBusy(false);
      return;
    }
    const safeName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-100);
    const filePath = `${user.id}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from("invoices")
      .upload(filePath, selectedFile, { contentType: selectedFile.type, upsert: false });
    if (uploadError) {
      setError("De factuur kon niet veilig worden opgeslagen. Controleer de Supabase Storage-instellingen.");
      setBusy(false);
      return;
    }
    const now = Date.now();
    const itemsSubtotal = parsed.items.reduce((sum, item) => sum + item.lineTotal, 0);
    const shippingFee = Math.max(0, parsed.shippingFee || 0);
    const invoiceTotal = itemsSubtotal + shippingFee;
    const invoiceCurrency = (parsed.currency || "EUR").toUpperCase();
    const euroTotal = Math.round(invoiceTotal * invoiceExchangeRate * 100) / 100;
    p.setProducts((current: Product[]) => {
      const next = [...current];
      parsed.items.forEach((item, index) => {
        const shippingShare = itemsSubtotal > 0
          ? shippingFee * (item.lineTotal / itemsSubtotal)
          : shippingFee / parsed.items.length;
        const landedLineTotal = item.lineTotal + shippingShare;
        const landedUnitCost = Math.round((landedLineTotal / item.quantity) * 100) / 100;
        const sku = item.sku.trim().toLowerCase();
        const description = item.description.trim().toLowerCase();
        const existingIndex = next.findIndex((product) =>
          (sku && product.sku.trim().toLowerCase() === sku) ||
          product.name.trim().toLowerCase() === description,
        );
        const movement = {
          id: now + index,
          date: parsed.invoiceDate || today,
          type: "inkoop" as const,
          quantity: item.quantity,
          reason: `Factuur ${parsed.invoiceNumber || "zonder nummer"}`,
          sourceInvoiceId: now,
        };
        if (existingIndex >= 0) {
          const product = next[existingIndex];
          next[existingIndex] = {
            ...product,
            stock: product.stock === 999 ? 999 : product.stock + item.quantity,
            cost: landedUnitCost,
            supplier: parsed.supplier || product.supplier,
            lastPurchaseQty: item.quantity,
            lastPurchaseTotal: landedLineTotal,
            stockInitialized: true,
            stockHistory: [...(product.stockHistory || []), movement],
          };
        } else {
          next.push({
            id: now + index,
            name: item.description,
            sku: item.sku || `AUTO-${String(now + index).slice(-6)}`,
            category: "Overig",
            cost: landedUnitCost,
            price: landedUnitCost,
            stock: item.quantity,
            min: 0,
            active: true,
            supplier: parsed.supplier,
            lastPurchaseQty: item.quantity,
            lastPurchaseTotal: landedLineTotal,
            stockInitialized: true,
            stockHistory: [movement],
          });
        }
      });
      return next;
    });
    p.setPurchaseInvoices((current: PurchaseInvoice[]) => [
      {
        id: now,
        number: parsed.invoiceNumber,
        supplier: parsed.supplier,
        date: parsed.invoiceDate,
        total: invoiceTotal,
        currency: invoiceCurrency,
        fileName: selectedFile.name,
        filePath,
        itemCount: parsed.items.length,
      },
      ...current,
    ]);
    p.setCosts((current: Cost[]) => [
      {
        id: now,
        supplier: parsed.supplier || "Onbekende leverancier",
        date: parsed.invoiceDate || today,
        category: "Inkoop",
        description: `Inkoopfactuur ${parsed.invoiceNumber || selectedFile.name}`,
        amount: euroTotal,
        currency: invoiceCurrency,
        originalAmount: invoiceTotal,
        exchangeRate: invoiceExchangeRate,
        status: "Betaald",
        sourceInvoiceId: now,
      },
      ...current,
    ]);
    p.notify(`${parsed.items.length} voorraadregels verwerkt en ${euro(euroTotal)} als kosten geboekt`);
    p.close();
  };

  return (
    <div className="modal-wrap" onMouseDown={(event) => event.target === event.currentTarget && p.close()}>
      <div className="modal invoice-import-modal">
        <button type="button" className="modal-close" onClick={p.close}>×</button>
        <h2>Inkoopfactuur verwerken</h2>
        <p>Upload een PDF of foto. Controleer altijd de herkenning voordat je de voorraad bijwerkt.</p>
        {!parsed ? (
          <form onSubmit={analyse}>
            <label className="invoice-dropzone">
              <span>▤</span>
              <b>Selecteer een inkoopfactuur</b>
              <small>PDF, JPG of PNG · maximaal 10 MB</small>
              <input name="invoice" type="file" accept="application/pdf,image/jpeg,image/png" required onChange={(event) => setSelectedFile(event.target.files?.[0] || null)} />
            </label>
            {error && <div className="auth-message">{error}</div>}
            <div className="privacy-note">Na jouw bevestiging wordt het originele bestand privé bewaard onder Facturen.</div>
            <div className="modal-actions">
              <button type="button" className="secondary" onClick={p.close}>Annuleren</button>
              <button className="primary" disabled={busy}>{busy ? "Factuur analyseren…" : "Factuur analyseren"}</button>
            </div>
          </form>
        ) : (
          <div>
            <div className="invoice-summary">
              <div><small>Leverancier</small><b>{parsed.supplier || "Niet herkend"}</b></div>
              <div><small>Factuurnummer</small><b>{parsed.invoiceNumber || "Niet herkend"}</b></div>
              <div><small>Datum</small><b>{parsed.invoiceDate || "Niet herkend"}</b></div>
              <div><small>Verzendkosten</small><b>{parsed.currency || "EUR"} {(parsed.shippingFee || 0).toFixed(2)}</b></div>
            </div>
            <div className="invoice-lines">
              {parsed.items.map((item, index) => (
                <div key={`${item.sku}-${index}`}>
                  <div><b>{item.description}</b><small>{item.sku || "Geen SKU"}</small></div>
                  <span>{item.quantity} stuks</span>
                  <strong>{euro(displayedUnitCost(item))} / stuk incl. verzending</strong>
                </div>
              ))}
            </div>
            {(parsed.currency || "EUR").toUpperCase() !== "EUR" && (
              <label className="full">
                Wisselkoers naar euro (1 {parsed.currency.toUpperCase()} = hoeveel EUR?)
                <input
                  type="number"
                  min="0.000001"
                  step="0.000001"
                  value={invoiceExchangeRate}
                  onChange={(event) => setInvoiceExchangeRate(Math.max(0.000001, Number(event.target.value) || 1))}
                />
              </label>
            )}
            <div className="privacy-note">Controleer aantallen en bedragen. Automatische herkenning kan fouten maken.</div>
            <div className="modal-actions">
              <button type="button" className="secondary" onClick={() => setParsed(null)}>Andere factuur</button>
              <button type="button" className="primary" disabled={busy} onClick={applyInventory}>{busy ? "Opslaan…" : "Factuur bewaren en voorraad bijboeken"}</button>
            </div>
            {error && <div className="auth-message">{error}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

function PurchaseFields({
  orderQty,
  setOrderQty,
  orderTotal,
  setOrderTotal,
  calculatedUnitCost,
}: any) {
  return (
    <>
      <div className="form-grid purchase-fields">
        <label>
          Hoeveel stuks heb je besteld? *
          <input
            name="orderedQty"
            type="number"
            min="1"
            required
            value={orderQty || ""}
            onChange={(e) => setOrderQty(Number(e.target.value))}
            placeholder="Bijv. 100"
          />
        </label>
        <label>
          Totaal betaald voor deze bestelling *
          <div className="money-input">
            <span>€</span>
            <input
              name="purchaseTotal"
              type="number"
              min="0"
              step=".01"
              required
              value={orderTotal || ""}
              onChange={(e) => setOrderTotal(Number(e.target.value))}
              placeholder="Bijv. 580,00"
            />
          </div>
        </label>
        <label className="full">
          Leverancier
          <input name="supplier" placeholder="Bijv. NFC Supply Europe" />
        </label>
      </div>
      <div className={`cost-result ${calculatedUnitCost ? "ready" : ""}`}>
        <div>
          <small>AUTOMATISCH BEREKEND</small>
          <b>Kostprijs per stuk</b>
          <span>Totaalbedrag ÷ aantal stuks</span>
        </div>
        <strong>
          {calculatedUnitCost ? euro(calculatedUnitCost) : "€ 0,00"}
        </strong>
      </div>
    </>
  );
}
