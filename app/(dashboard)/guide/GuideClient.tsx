"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard, ShoppingBag, RotateCcw, Package, Sparkles,
  Library, Video, BarChart2, Route, TrendingUp, Settings, ChevronRight,
} from "lucide-react"

const sections = [
  { id: "dashboard", label: "Panou de control", icon: LayoutDashboard },
  { id: "orders", label: "Comenzi", icon: ShoppingBag },
  { id: "returns", label: "Retururi", icon: RotateCcw },
  { id: "products", label: "Produse", icon: Package },
  { id: "listing", label: "Listing AI", icon: Sparkles },
  { id: "videos", label: "Biblioteca video", icon: Library },
  { id: "video-create", label: "Creare video", icon: Video },
  { id: "campaigns", label: "Campanii", icon: BarChart2 },
  { id: "journey", label: "Parcurs Client", icon: Route },
  { id: "profitability", label: "Profitabilitate", icon: TrendingUp },
  { id: "settings", label: "Setări", icon: Settings },
]

function Kv({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-2 border-b border-[#F5F5F4] last:border-0">
      <span className="text-sm font-medium text-[#1C1917] w-48 flex-shrink-0">{label}</span>
      <span className="text-sm text-[#44403C] flex-1">{children}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h3 className="text-sm font-semibold text-[#D4AF37] uppercase tracking-wider mb-3">{title}</h3>
      {children}
    </div>
  )
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#FAFAF9] border border-[#E7E5E4] rounded-xl p-4 text-sm text-[#44403C] leading-relaxed">
      {children}
    </div>
  )
}

function Tag({ color, children }: { color: "green" | "yellow" | "red" | "blue" | "gray"; children: React.ReactNode }) {
  const colors = {
    green: "bg-green-50 text-green-700 border-green-200",
    yellow: "bg-yellow-50 text-yellow-700 border-yellow-200",
    red: "bg-red-50 text-red-700 border-red-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    gray: "bg-[#F5F5F4] text-[#78716C] border-[#E7E5E4]",
  }
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border", colors[color])}>
      {children}
    </span>
  )
}

const content: Record<string, React.ReactNode> = {
  dashboard: (
    <>
      <p className="text-sm text-[#44403C] mb-6 leading-relaxed">
        Panoul de control oferă o privire de ansamblu rapidă asupra performanței magazinului tău în perioada selectată.
      </p>
      <Section title="Carduri de sumar">
        <div className="space-y-0 border border-[#E7E5E4] rounded-xl overflow-hidden mb-4">
          <Kv label="Venit net">Totalul vânzărilor din comenzile plătite, minus returnările estimate.</Kv>
          <Kv label="Comenzi">Numărul de comenzi finalizate în perioadă.</Kv>
          <Kv label="Profit net">Venitul net minus toate costurile (COGS, transport, ambalaj, taxe, reclame).</Kv>
          <Kv label="Cheltuieli reclame">Suma cheltuită pe Meta Ads (Facebook/Instagram) în perioadă.</Kv>
        </div>
      </Section>
      <Section title="Selectorul de perioadă">
        <InfoBox>
          Poți alege perioade predefinite (azi, 7 zile, 30 zile, luna curentă) sau o perioadă personalizată. Toate datele din pagină se actualizează automat.
        </InfoBox>
      </Section>
    </>
  ),

  orders: (
    <>
      <p className="text-sm text-[#44403C] mb-6 leading-relaxed">
        Secțiunea Comenzi afișează toate comenzile sincronizate din Shopify. Datele sunt actualizate automat la fiecare sincronizare.
      </p>
      <Section title="Coloane tabel">
        <div className="space-y-0 border border-[#E7E5E4] rounded-xl overflow-hidden mb-4">
          <Kv label="Număr comandă">ID-ul comenzii din Shopify (#1234).</Kv>
          <Kv label="Client">Numele și email-ul clientului.</Kv>
          <Kv label="Dată">Data la care a fost plasată comanda.</Kv>
          <Kv label="Produse">Produsele achiziționate cu cantitățile aferente.</Kv>
          <Kv label="Total">Valoarea totală a comenzii cu TVA inclus.</Kv>
          <Kv label="Transport">Suma plătită de client pentru livrare.</Kv>
          <Kv label="Status">Statusul financiar al comenzii.</Kv>
        </div>
      </Section>
      <Section title="Statusuri comenzi">
        <div className="flex flex-wrap gap-2">
          <Tag color="green">paid — plătită</Tag>
          <Tag color="yellow">pending — în așteptare</Tag>
          <Tag color="blue">partially_refunded — rambursată parțial</Tag>
          <Tag color="red">refunded — rambursată complet</Tag>
        </div>
      </Section>
    </>
  ),

  returns: (
    <>
      <p className="text-sm text-[#44403C] mb-6 leading-relaxed">
        Retururile sincronizate din Shopify. Fiecare retur afectează calculele de profitabilitate prin reducerea venitului net.
      </p>
      <Section title="Cum funcționează">
        <InfoBox>
          Rata de retur configurată per produs (ex: 8%) este folosită în engine-ul de profitabilitate pentru a estima veniturile pierdute. Retururile reale din Shopify sunt afișate aici pentru reconciliere.
        </InfoBox>
      </Section>
    </>
  ),

  products: (
    <>
      <p className="text-sm text-[#44403C] mb-6 leading-relaxed">
        Pagina Produse afișează toate produsele sincronizate din Shopify. Pentru calcule corecte de profitabilitate, fiecare produs trebuie să aibă configurate costurile.
      </p>
      <Section title="Configurare costuri produs">
        <div className="space-y-0 border border-[#E7E5E4] rounded-xl overflow-hidden mb-4">
          <Kv label="COGS (cost achiziție)">Prețul de achiziție per unitate, în RON, fără TVA.</Kv>
          <Kv label="Furnizor cu factură TVA">Activează dacă primești factură cu TVA de la furnizor — TVA-ul plătit pe achiziție se deduce din TVA-ul colectat.</Kv>
          <Kv label="Rată TVA">Cota TVA aplicată produsului (standard: 19%).</Kv>
          <Kv label="Rată retur">Procentul estimat de returnări (ex: 0.08 = 8%). Reduce venitul net și generează o provizion de stoc.</Kv>
        </div>
        <InfoBox>
          Costurile de transport și ambalaj se configurează la nivel de organizație în <strong>Setări → Costuri implicite</strong> și se aplică tuturor produselor.
        </InfoBox>
      </Section>
      <Section title="Marginal Ratio">
        <InfoBox>
          <strong>Marginal Ratio = Prețul de vânzare ÷ COGS</strong><br /><br />
          Indica cât de mult markup ai față de costul produsului:<br />
          <span className="inline-flex gap-3 mt-2 flex-wrap">
            <Tag color="green">≥ 2.5x — viabil pentru reclame</Tag>
            <Tag color="yellow">1.5x–2.5x — risc mediu</Tag>
            <Tag color="red">{'<'} 1.5x — neviabil</Tag>
          </span>
        </InfoBox>
      </Section>
    </>
  ),

  listing: (
    <>
      <p className="text-sm text-[#44403C] mb-6 leading-relaxed">
        Listing AI generează automat titluri și descrieri optimizate pentru produsele tale folosind Claude AI, pe baza imaginilor și a numelui produsului.
      </p>
      <Section title="Cum se folosește">
        <div className="space-y-2 text-sm text-[#44403C]">
          <div className="flex gap-3"><ChevronRight className="w-4 h-4 text-[#D4AF37] mt-0.5 flex-shrink-0" /><span>Selectează un produs din listă.</span></div>
          <div className="flex gap-3"><ChevronRight className="w-4 h-4 text-[#D4AF37] mt-0.5 flex-shrink-0" /><span>AI-ul analizează imaginile și generează un titlu SEO-optimizat și o descriere detaliată.</span></div>
          <div className="flex gap-3"><ChevronRight className="w-4 h-4 text-[#D4AF37] mt-0.5 flex-shrink-0" /><span>Poți edita rezultatul înainte de a-l salva sau publica înapoi în Shopify.</span></div>
        </div>
      </Section>
    </>
  ),

  videos: (
    <>
      <p className="text-sm text-[#44403C] mb-6 leading-relaxed">
        Biblioteca Video stochează toate videoclipurile generate sau uploadate în platformă. Poți vizualiza, descărca sau reutiliza conținut pentru campanii.
      </p>
    </>
  ),

  "video-create": (
    <>
      <p className="text-sm text-[#44403C] mb-6 leading-relaxed">
        Creare Video îți permite să generezi videoclipuri de produs cu AI, pornind de la imagini și un script sau prompt text.
      </p>
      <Section title="Cum se folosește">
        <div className="space-y-2 text-sm text-[#44403C]">
          <div className="flex gap-3"><ChevronRight className="w-4 h-4 text-[#D4AF37] mt-0.5 flex-shrink-0" /><span>Selectează un produs sau uploadează imagini manual.</span></div>
          <div className="flex gap-3"><ChevronRight className="w-4 h-4 text-[#D4AF37] mt-0.5 flex-shrink-0" /><span>Completează scriptul sau lasă AI-ul să genereze unul automat.</span></div>
          <div className="flex gap-3"><ChevronRight className="w-4 h-4 text-[#D4AF37] mt-0.5 flex-shrink-0" /><span>Videoclipul generat apare în Bibliotecă după procesare.</span></div>
        </div>
      </Section>
    </>
  ),

  campaigns: (
    <>
      <p className="text-sm text-[#44403C] mb-6 leading-relaxed">
        Campanii sincronizează automat campaniile tale Meta Ads (Facebook/Instagram) și afișează performanța în timp real.
      </p>
      <Section title="Metrici campanie">
        <div className="space-y-0 border border-[#E7E5E4] rounded-xl overflow-hidden mb-4">
          <Kv label="Spend">Suma cheltuită pe reclamă în perioadă (RON sau EUR convertit).</Kv>
          <Kv label="Reach">Numărul de persoane unice care au văzut reclama.</Kv>
          <Kv label="Impressions">Numărul total de afișări (o persoană poate vedea de mai multe ori).</Kv>
          <Kv label="Clicks">Numărul de click-uri pe reclamă.</Kv>
          <Kv label="CTR">Click-Through Rate = Clicks ÷ Impressions × 100. Cât % din cei care văd reclama dau click.</Kv>
          <Kv label="CPM">Cost per 1000 Impressions. Cât costă să ajungi la 1000 de persoane.</Kv>
          <Kv label="Purchases">Conversii de tip achiziție raportate de Meta Pixel.</Kv>
          <Kv label="ROAS">Return on Ad Spend = Venit atribuit reclamei ÷ Spend. Ex: 3.5 înseamnă 3.5 RON venit per 1 RON cheltuit.</Kv>
        </div>
      </Section>
      <Section title="Asocierea campanie → produs">
        <InfoBox>
          <strong>De ce este necesară?</strong> Rise nu poate știi automat ce produs promovează o campanie. Trebuie să asociezi manual fiecare campanie cu produsul corespunzător.<br /><br />
          <strong>Cum:</strong> Click pe o campanie → în header-ul paginii găsești butonul <em>"Asociază produs"</em> → selectează produsul din dropdown.<br /><br />
          Fără această asociere, cheltuielile de reclamă <strong>nu apar</strong> în calculele de profitabilitate.
        </InfoBox>
      </Section>
      <Section title="Statusuri campanie">
        <div className="flex flex-wrap gap-2">
          <Tag color="green">ACTIVE — activă</Tag>
          <Tag color="gray">PAUSED — pauzată</Tag>
          <Tag color="gray">ARCHIVED — arhivată</Tag>
        </div>
      </Section>
    </>
  ),

  journey: (
    <>
      <p className="text-sm text-[#44403C] mb-6 leading-relaxed">
        Parcurs Client vizualizează întregul funnel de la prima interacțiune cu reclama până la finalizarea comenzii. Ajută să înțelegi unde pierzi clienți.
      </p>
      <Section title="Etapele funnel-ului">
        <div className="space-y-0 border border-[#E7E5E4] rounded-xl overflow-hidden mb-4">
          <Kv label="Reach / Impressions">Câte persoane au văzut reclamele tale.</Kv>
          <Kv label="Clicks (Link)">Câți au dat click pe reclamă și au ajuns pe site.</Kv>
          <Kv label="Add to Cart">Câți au adăugat un produs în coș.</Kv>
          <Kv label="Reached Checkout">Câți au inițiat procesul de checkout.</Kv>
          <Kv label="Purchases">Câți au finalizat comanda.</Kv>
        </div>
      </Section>
      <Section title="Rate de conversie de referință (Blueprint)">
        <div className="space-y-0 border border-[#E7E5E4] rounded-xl overflow-hidden">
          <Kv label="Vizitatori → Achiziție">2.5% — rata standard de conversie</Kv>
          <Kv label="Vizitatori → Add to Cart">6% — benchmark optim</Kv>
          <Kv label="Vizitatori → Checkout">4.5% — benchmark optim</Kv>
        </div>
      </Section>
    </>
  ),

  profitability: (
    <>
      <p className="text-sm text-[#44403C] mb-6 leading-relaxed">
        Profitabilitate este secțiunea centrală a platformei. Calculează profitul real per produs după toate costurile: COGS, transport, ambalaj, TVA, taxe, reclame și returnări.
      </p>
      <Section title="Metrici principale">
        <div className="space-y-0 border border-[#E7E5E4] rounded-xl overflow-hidden mb-4">
          <Kv label="Venit brut">Suma totală a prețurilor cu TVA pentru unitățile vândute.</Kv>
          <Kv label="Venit net">Venit brut minus returnările estimate (unitati × rata retur × preț mediu).</Kv>
          <Kv label="Profit net">Venitul net ex-TVA minus COGS, transport, ambalaj, taxe, provizioane retur și cheltuieli reclame.</Kv>
          <Kv label="Marjă netă %">Profit net ÷ Venit net ex-TVA × 100. Cât % din fiecare leu de vânzare rămâne profit curat.</Kv>
          <Kv label="Ads Spend RON">Cheltuielile Meta Ads alocate acestui produs (din campaniile asociate, împărțite proporțional).</Kv>
          <Kv label="ROAS actual">Venit net ÷ Ads Spend RON. Câți lei de venit generezi per leu cheltuit pe reclame.</Kv>
        </div>
      </Section>
      <Section title="KPI-uri Blueprint (break-even)">
        <InfoBox>
          Aceste valori provin din metodologia Blueprint Supreme Ecom KPI System și indică pragurile critice pentru fiecare produs.
        </InfoBox>
        <div className="space-y-0 border border-[#E7E5E4] rounded-xl overflow-hidden mt-3">
          <Kv label="CPP Break-Even">Cost Per Purchase la care profitul este 0. Formula: (Preț ex-TVA × (1 - fee Shopify)) - (COGS + Transport + Ambalaj). Acesta este maximul pe care îl poți plăti per achiziție fără să pierzi.</Kv>
          <Kv label="ROAS Break-Even">Prețul de vânzare ÷ CPP Break-Even. ROAS-ul minim necesar pentru a nu pierde bani.</Kv>
          <Kv label="½ CPP Break-Even">Jumătate din CPP_BE. Dacă costul per achiziție depășește această valoare în primele 3 zile, oprești campania.</Kv>
          <Kv label="CPP Target">CPP_BE minus marja de profit dorită. Costul per achiziție la care atingi targetul de profit setat.</Kv>
          <Kv label="ROAS Target">Prețul de vânzare ÷ CPP Target. ROAS-ul necesar pentru a atinge marja de profit dorită.</Kv>
          <Kv label="CPATC Target">CPP Target × (2.5% ÷ 6%). Cost Per Add-To-Cart țintă, bazat pe ratele standard de conversie.</Kv>
          <Kv label="CPULC Target">CPP Target × 2.5%. Cost Per Unique Link Click țintă.</Kv>
          <Kv label="CPIC Target">CPP Target × (2.5% ÷ 4.5%). Cost Per Initiated Checkout țintă.</Kv>
        </div>
      </Section>
      <Section title="Marginal Ratio">
        <InfoBox>
          <strong>Produs: Preț vânzare ÷ COGS.</strong> Arată cât de mult markup ai față de costul produsului. Blueprint-ul recomandă minimum 2.5x pentru a putea rula reclame profitabil.<br /><br />
          <strong>Global: Venit brut ÷ (COGS total + Ads Spend).</strong> Eficiența globală a cheltuielilor variabile.
        </InfoBox>
      </Section>
      <Section title="Recomandări automate">
        <div className="space-y-0 border border-[#E7E5E4] rounded-xl overflow-hidden">
          <Kv label="SCALE"><Tag color="green">Scalează</Tag> — marjă bună, ROAS peste target. Crește bugetul.</Kv>
          <Kv label="OPTIMIZE"><Tag color="yellow">Optimizează</Tag> — performanță medie, necesită ajustări creative sau de targeting.</Kv>
          <Kv label="PAUSE"><Tag color="red">Oprește</Tag> — ROAS sub break-even sau marjă negativă. Campania pierde bani.</Kv>
          <Kv label="DEAD_STOCK"><Tag color="gray">Stoc mort</Tag> — nicio vânzare în perioadă. Evaluează reducere sau scoatere din portofoliu.</Kv>
        </div>
      </Section>
      <Section title="Tip impozit (afectează calculele)">
        <div className="space-y-0 border border-[#E7E5E4] rounded-xl overflow-hidden">
          <Kv label="MICRO_1">Microîntreprindere 1% — impozitul se calculează din venitul net brut (nu din profit).</Kv>
          <Kv label="MICRO_3">Microîntreprindere 3% — similar cu MICRO_1 dar cota mai mare.</Kv>
          <Kv label="PROFIT_16">Impozit pe profit 16% — se aplică doar pe profitul pozitiv după toate cheltuielile.</Kv>
        </div>
      </Section>
    </>
  ),

  settings: (
    <>
      <p className="text-sm text-[#44403C] mb-6 leading-relaxed">
        Setările controlează integrările externe și parametrii fiscali/operaționali ai organizației tale.
      </p>
      <Section title="Integrare Shopify">
        <InfoBox>
          Conectează-ți magazinul Shopify pentru a sincroniza automat produse, comenzi și retururi. Ai nevoie de un <strong>Custom App Token</strong> din panoul de administrare Shopify cu permisiunile: read_products, read_orders, read_fulfillments.
        </InfoBox>
      </Section>
      <Section title="Integrare Meta Ads">
        <InfoBox>
          Conectează contul Meta Business pentru a sincroniza campaniile, ad set-urile și reclamele. Datele de performanță (spend, reach, purchases, ROAS) sunt trase automat via Meta Marketing API.<br /><br />
          Sincronizarea se declanșează manual din această pagină sau automat la interval configurat.
        </InfoBox>
      </Section>
      <Section title="Setări organizație">
        <div className="space-y-0 border border-[#E7E5E4] rounded-xl overflow-hidden mb-4">
          <Kv label="Tip impozit">MICRO_1 / MICRO_3 / PROFIT_16 — alege regimul fiscal al firmei tale. Afectează calculul impozitului în Profitabilitate.</Kv>
          <Kv label="Plătitor TVA">Activează dacă firma ta este plătitoare de TVA. Dezactivat = calculele se fac fără TVA colectat/deductibil.</Kv>
          <Kv label="Cost transport implicit">Costul curier per comandă în RON (ex: 20 RON). Se aplică tuturor produselor dacă nu e setat individual.</Kv>
          <Kv label="Cost ambalaj implicit">Costul ambalajului per unitate în RON (ex: 4.97 RON).</Kv>
          <Kv label="Fee Shopify">Comisionul Shopify per tranzacție (ex: 0.02 = 2%). Setat 0 dacă ești pe planul cu fee fix lunar fără comision per tranzacție.</Kv>
          <Kv label="Curs EUR → RON">Cursul de schimb folosit pentru conversia cheltuielilor Meta din EUR în RON.</Kv>
          <Kv label="Target marjă profit %">Marja de profit țintă (ex: 0.20 = 20%). Folosită pentru calculul CPP Target și ROAS Target.</Kv>
        </div>
      </Section>
    </>
  ),
}

export function GuideClient() {
  const [active, setActive] = useState("dashboard")

  return (
    <div className="flex gap-0 min-h-[calc(100vh-4rem)]">
      {/* Left nav */}
      <aside className="w-56 flex-shrink-0 border-r border-[#E7E5E4] bg-[#FAFAF9] py-6 px-3 sticky top-0 self-start">
        <p className="px-3 mb-3 text-[10px] font-semibold uppercase tracking-widest text-[#78716C]/70">Secțiuni</p>
        <nav className="space-y-0.5">
          {sections.map((s) => {
            const Icon = s.icon
            return (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                className={cn(
                  "flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-left transition-colors relative",
                  active === s.id
                    ? "bg-white text-[#1C1917] font-semibold shadow-sm"
                    : "text-[#78716C] hover:bg-white hover:text-[#1C1917]"
                )}
              >
                {active === s.id && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[#D4AF37] rounded-r-full" />
                )}
                <Icon className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.5} />
                {s.label}
              </button>
            )
          })}
        </nav>
      </aside>

      {/* Content */}
      <main className="flex-1 px-8 py-8 max-w-3xl">
        <h2 className="text-xl font-bold text-[#1C1917] mb-1">
          {sections.find(s => s.id === active)?.label}
        </h2>
        <div className="w-8 h-0.5 bg-[#D4AF37] rounded-full mb-6" />
        {content[active]}
      </main>
    </div>
  )
}
