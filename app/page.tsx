"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabase";

type View =
  | "dashboard"
  | "klanten"
  | "verkoop"
  | "producten"
  | "offertes"
  | "facturen"
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
  stock: number;
  min: number;
  active: boolean;
  lastPurchaseQty?: number;
  lastPurchaseTotal?: number;
  supplier?: string;
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
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    const result = mode === "login"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
    if (result.error)
      setMessage(
        mode === "login"
          ? "Inloggen is niet gelukt. Controleer je e-mailadres en wachtwoord."
          : "Account aanmaken is niet gelukt. Controleer de gegevens of probeer het later opnieuw.",
      );
    else if (mode === "signup" && !result.data.session)
      setMessage("Controleer je e-mail om je account te bevestigen.");
    setBusy(false);
  };
  return (
    <div className="auth-page">
      <div className="auth-panel">
        <div className="logo">N</div>
        <span className="eyebrow">NFC ADMINISTRATIE</span>
        <h1>{mode === "login" ? "Welkom terug, Auke" : "Maak je beveiligde account"}</h1>
        <form onSubmit={submit}>
          <label>E-mailadres<input name="email" type="email" required autoComplete="email" /></label>
          <label>Wachtwoord<input name="password" type="password" minLength={12} required autoComplete={mode === "login" ? "current-password" : "new-password"} /></label>
          {message && <div className="auth-message">{message}</div>}
          <button className="primary" disabled={busy}>{busy ? "Even wachten…" : mode === "login" ? "Inloggen" : "Account aanmaken"}</button>
        </form>
        <button className="auth-switch" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setMessage(""); }}>
          {mode === "login" ? "Nog geen account? Account aanmaken" : "Al een account? Inloggen"}
        </button>
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
  const [quotes, setQuotes] = useState(seedQuotes);
  const [costs, setCosts] = useState(seedCosts);
  const [period, setPeriod] = useState("Maand");
  const [selected, setSelected] = useState<Customer | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<"laden" | "opgeslagen" | "fout">("laden");

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
    if (!userId) {
      setLoaded(false);
      return;
    }
    let active = true;
    (async () => {
      setSyncStatus("laden");
      const { data, error } = await supabase
        .from("crm_state")
        .select("customers,products,invoices,quotes,costs")
        .eq("user_id", userId)
        .maybeSingle();
      if (!active) return;
      if (error) {
        setSyncStatus("fout");
        setLoaded(true);
        return;
      }
      if (data) {
        setCustomers(data.customers || []);
        setProducts(data.products || []);
        setInvoices(data.invoices || []);
        setQuotes(data.quotes || []);
        setCosts(data.costs || []);
      } else {
        const cleaned = {
          customers: [],
          products: [],
          invoices: [],
          quotes: [],
          costs: [],
        };
        setCustomers(cleaned.customers);
        setProducts(cleaned.products);
        setInvoices(cleaned.invoices);
        setQuotes(cleaned.quotes);
        setCosts(cleaned.costs);
        await supabase.from("crm_state").insert({ user_id: userId, ...cleaned });
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
      const state = { customers, products, invoices, quotes, costs };
      const { error } = await supabase.from("crm_state").upsert({
        user_id: userId,
        ...state,
        updated_at: new Date().toISOString(),
      });
      setSyncStatus(error ? "fout" : "opgeslagen");
    }, 500);
    return () => clearTimeout(timer);
  }, [customers, products, invoices, quotes, costs, loaded, userId]);
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
      <Invoices {...{ invoices, setInvoices, query, setModal, notify }} />
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
          <div className="logo">N</div>
          <div>
            <b>NFC Administratie</b>
            <small>Jouw bedrijf, helder geregeld</small>
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
  const overdue = p.invoices
    .filter((i: Invoice) => i.status === "Te laat")
    .reduce((a: number, i: Invoice) => a + i.total - i.paid, 0);
  const followUps = p.customers.filter(
    (c: Customer) => c.nextFollow && c.nextFollow <= today,
  );
  const lowStock = p.products.filter((x: Product) => x.stock < x.min);
  return (
    <>
      <PageHead
        eyebrow="VANDAAG"
        title="Goedemorgen, Auke"
        desc="Dit is wat er vandaag speelt in je bedrijf."
        action="Nieuwe verkoop"
        onAction={() => p.go("facturen")}
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
          icon="▤"
          label="Openstaand"
          value={euro(p.outstanding)}
          sub={`${p.invoices.filter((i: Invoice) => i.total > i.paid).length} facturen`}
          warn
          onClick={() => p.go("facturen")}
        />
        <Kpi
          icon="!"
          label="Achterstallig"
          value={euro(overdue)}
          sub={`${p.invoices.filter((i: Invoice) => i.status === "Te laat").length} facturen`}
          danger
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
      <div className="how-it-works">
        <b>Zo werkt het</b>
        <span>1. Voeg een product toe</span>
        <i>→</i>
        <span>2. Vul aantal en totaalbedrag in</span>
        <i>→</i>
        <span>3. De kostprijs per stuk wordt berekend</span>
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
                <span>Verkoopprijs</span>
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
              <button
                className="purchase-button"
                onClick={() => p.setModal(`stock-order:${x.id}`)}
              >
                ＋ Inkoop registreren
              </button>
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
            <button onClick={() => p.notify(`${i.number} als PDF klaargezet`)}>
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
  return (
    <>
      <PageHead
        title="Bedrijfsinstellingen"
        desc="Deze gegevens worden automatisch gebruikt op offertes en facturen"
      />
      <div className="settings-layout">
        <div className="settings-nav">
          <button className="active">Bedrijfsgegevens</button>
          <button>Facturatie</button>
          <button>Nummering</button>
          <button>Documentteksten</button>
          <button>Back-up & export</button>
          <button>Wijzigingslogboek</button>
        </div>
        <form
          className="card settings"
          onSubmit={(e) => {
            e.preventDefault();
            notify("Instellingen veilig opgeslagen");
          }}
        >
          <h2>Bedrijfsgegevens</h2>
          <p>Basisinformatie voor je documenten en communicatie.</p>
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
  const type = p.type.split(":")[0];
  const recordId = Number(p.type.split(":")[1]);
  const close = p.close;
  const calculatedUnitCost =
    orderQty > 0 ? Math.round((orderTotal / orderQty) * 100) / 100 : 0;
  const convertedCost = Math.round(costOriginal * costRate * 100) / 100;
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
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
          stock: qty,
          min: Number(f.get("min")),
          active: true,
          lastPurchaseQty: qty,
          lastPurchaseTotal: total,
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
                supplier: String(f.get("supplier") || x.supplier || ""),
              }
            : x,
        ),
      );
      p.notify(
        `${qty} stuks toegevoegd — nieuwe kostprijs ${euro(cost)} per stuk`,
      );
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
              ["invoice", "▤", "Nieuwe factuur"],
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
            <button>＋ Nieuwe verkoop</button>
            <button>＋ Factuur</button>
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
              <p>{p.selected.note}</p>
              <button className="link">Notitie bewerken</button>
            </div>
          </div>
          <h3>Contactgeschiedenis</h3>
          <div className="timeline">
            <div>
              <i />
              <b>E-mail gestuurd</b>
              <small>18 juli 2026 · door Alex</small>
              <p>
                Bedankt voor de bestelling en installatie-instructies verstuurd.
              </p>
            </div>
            <div>
              <i />
              <b>Telefonisch gesproken</b>
              <small>11 juli 2026 · door Alex</small>
              <p>Interesse besproken in tafelstandaards voor het terras.</p>
            </div>
          </div>
        </div>
      </div>
    );
  const titles: any = {
    customer: "Nieuwe klant",
    product: "Product toevoegen",
    cost: "Nieuwe uitgave",
    quote: "Nieuwe offerte",
    invoice: "Nieuwe factuur",
    payment: "Betaling registreren",
    contact: "Contactmoment toevoegen",
    "stock-order": "Inkoop registreren",
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
            {type === "stock-order" ? "Inkoop opslaan" : "Opslaan"}
          </button>
        </div>
      </form>
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
