
"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Tx = {
  id: string;
  description: string;
  amount: number;
  kind: "income" | "expense";
  category: string;
  created_at: string;
  created_by?: string;
};

type FutureBill = {
  id: string;
  description: string;
  amount: number;
  category: string;
  due_date: string;
  paid: boolean;
  paid_at: string | null;
  transaction_id: string | null;
};

type Profile = { id: string; email?: string };

const money = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const monthNow = today().slice(0, 7);

const categories = [
  "Alimentação",
  "Moradia",
  "Transporte",
  "Combustível",
  "Saúde",
  "Lazer",
  "Salário",
  "Contas",
  "Educação",
  "Restaurantes",
  "Compras",
  "Pets",
  "Cartão de crédito",
  "Outros",
];

const categoryIcons: Record<string, string> = {
  "Alimentação": "🛒",
  "Moradia": "🏠",
  "Transporte": "🚗",
  "Combustível": "⛽",
  "Saúde": "💊",
  "Lazer": "🎮",
  "Salário": "💰",
  "Contas": "💡",
  "Educação": "📚",
  "Restaurantes": "🍔",
  "Compras": "🛍️",
  "Pets": "🐶",
  "Cartão de crédito": "💳",
  "Outros": "📦",
};

const icon = (category: string) => categoryIcons[category] || "📌";

const navItems = [
  { id: "home", label: "Visão geral", emoji: "◫" },
  { id: "expenses", label: "Despesas", emoji: "↘" },
  { id: "transactions", label: "Lançamentos", emoji: "⇄" },
  { id: "bills", label: "Contas futuras", emoji: "▤" },
  { id: "history", label: "Histórico mensal", emoji: "▦" },
  { id: "assistant", label: "Assistente IA", emoji: "✧" },
  { id: "family", label: "Família", emoji: "♡" },
];

export default function Home() {
  const [sessionUser, setSessionUser] = useState<Profile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [walletId, setWalletId] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [futureBills, setFutureBills] = useState<FutureBill[]>([]);
  const [activeView, setActiveView] = useState("home");

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [category, setCategory] = useState("Alimentação");
  const [filter, setFilter] = useState("all");

  const [billDescription, setBillDescription] = useState("");
  const [billAmount, setBillAmount] = useState("");
  const [billCategory, setBillCategory] = useState("Contas");
  const [billDueDate, setBillDueDate] = useState(today());

  const [selectedMonth, setSelectedMonth] = useState(monthNow);
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState(
    "Olá! Sou o assistente do DR DIAS. Posso resumir seus lançamentos e ajudar a planejar seu orçamento."
  );
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!supabase) {
      setAuthReady(true);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSessionUser(data.session?.user
        ? { id: data.session.user.id, email: data.session.user.email }
        : null);
      setAuthReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionUser(session?.user
        ? { id: session.user.id, email: session.user.email }
        : null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (sessionUser && supabase) loadWallet();
  }, [sessionUser]);

  async function loadWallet() {
    if (!supabase || !sessionUser) return;

    const { data: memberships, error } = await supabase
      .from("wallet_members")
      .select("wallet_id")
      .eq("user_id", sessionUser.id)
      .limit(1);

    if (error) {
      setNotice(error.message);
      return;
    }

    if (!memberships?.length) {
      setWalletId("");
      return;
    }

    const id = memberships[0].wallet_id as string;
    setWalletId(id);
    await Promise.all([loadTransactions(id), loadFutureBills(id)]);
  }

  async function loadTransactions(id: string) {
    if (!supabase) return;

    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("wallet_id", id)
      .order("created_at", { ascending: false });

    if (error) setNotice(error.message);
    else setTransactions((data || []) as Tx[]);
  }

  async function loadFutureBills(id: string) {
    if (!supabase) return;

    const { data, error } = await supabase
      .from("future_bills")
      .select("*")
      .eq("wallet_id", id)
      .order("due_date", { ascending: true });

    if (error) setNotice(error.message);
    else setFutureBills((data || []) as FutureBill[]);
  }

  async function authSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice("");

    if (!supabase) {
      setNotice("Configure o Supabase seguindo o arquivo LEIA-ME.md.");
      setBusy(false);
      return;
    }

    const result = authMode === "signup"
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

    if (result.error) setNotice(result.error.message);
    else if (authMode === "signup") {
      setNotice("Cadastro enviado. Confirme seu e-mail se solicitado.");
    }

    setBusy(false);
  }

  async function createWallet() {
    if (!supabase || !sessionUser) return;

    setBusy(true);
    const { data, error } = await supabase.rpc("create_family_wallet");

    if (error) setNotice(error.message);
    else {
      setWalletId(data as string);
      setNotice("Carteira familiar criada. Compartilhe o código de convite.");
      await Promise.all([
        loadTransactions(data as string),
        loadFutureBills(data as string)
      ]);
    }

    setBusy(false);
  }

  async function joinWallet() {
    if (!supabase) return;

    setBusy(true);
    const { error } = await supabase.rpc("join_family_wallet", {
      invite_code_input: inviteCode.trim().toUpperCase()
    });

    if (error) setNotice(error.message);
    else {
      setNotice("Você entrou na carteira familiar!");
      await loadWallet();
    }

    setBusy(false);
  }

  async function addTransaction(e: FormEvent) {
    e.preventDefault();

    const value = Number(amount.replace(",", "."));
    if (!supabase || !walletId || !description.trim() || !Number.isFinite(value) || value <= 0) {
      setNotice("Confira a descrição e informe um valor válido.");
      return;
    }

    setBusy(true);

    const { error } = await supabase.from("transactions").insert({
      wallet_id: walletId,
      description: description.trim(),
      amount: value,
      kind,
      category,
      created_by: sessionUser?.id
    });

    if (error) setNotice(error.message);
    else {
      setDescription("");
      setAmount("");
      await loadTransactions(walletId);
      setNotice("Lançamento salvo!");
    }

    setBusy(false);
  }

  async function addFutureBill(e: FormEvent) {
    e.preventDefault();

    const value = Number(billAmount.replace(",", "."));

    if (!supabase || !walletId || !billDescription.trim() ||
        !Number.isFinite(value) || value <= 0 || !billDueDate) {
      setNotice("Confira os dados da conta futura.");
      return;
    }

    setBusy(true);

    const { error } = await supabase.from("future_bills").insert({
      wallet_id: walletId,
      description: billDescription.trim(),
      amount: value,
      category: billCategory,
      due_date: billDueDate,
      created_by: sessionUser?.id
    });

    if (error) setNotice(error.message);
    else {
      setBillDescription("");
      setBillAmount("");
      setBillCategory("Contas");
      setBillDueDate(today());
      await loadFutureBills(walletId);
      setNotice("Conta futura cadastrada! Ela ainda não desconta do saldo.");
    }

    setBusy(false);
  }

  async function payFutureBill(bill: FutureBill) {
    if (!supabase || !walletId) return;

    if (bill.paid) {
      setNotice("Essa conta já está marcada como paga.");
      return;
    }

    if (!confirm(`Confirmar pagamento de ${bill.description} no valor de ${money(Number(bill.amount))}?`)) return;

    setBusy(true);

    const { error } = await supabase.rpc("pay_future_bill", {
      p_bill_id: bill.id
    });

    if (error) setNotice(error.message);
    else {
      await Promise.all([
        loadTransactions(walletId),
        loadFutureBills(walletId)
      ]);
      setNotice("Conta paga e despesa registrada no financeiro!");
    }

    setBusy(false);
  }

  async function deleteFutureBill(id: string) {
    if (!supabase || !confirm("Excluir esta conta futura?")) return;

    const { error } = await supabase
      .from("future_bills")
      .delete()
      .eq("id", id);

    if (error) setNotice(error.message);
    else await loadFutureBills(walletId);
  }

  async function editTransaction(t: Tx) {
    if (!supabase) return;

    const newDescription = prompt("Descrição do lançamento:", t.description);
    if (newDescription === null || !newDescription.trim()) return;

    const newAmountText = prompt("Valor em reais:", String(t.amount).replace(".", ","));
    if (newAmountText === null) return;

    const newAmount = Number(newAmountText.replace(",", "."));

    if (!Number.isFinite(newAmount) || newAmount <= 0) {
      setNotice("Informe um valor válido.");
      return;
    }

    const { error } = await supabase.from("transactions").update({
      description: newDescription.trim(),
      amount: newAmount
    }).eq("id", t.id);

    if (error) setNotice(error.message);
    else await loadTransactions(walletId);
  }

  async function deleteTransaction(id: string) {
    if (!supabase || !confirm("Excluir este lançamento?")) return;

    const { error } = await supabase.from("transactions").delete().eq("id", id);

    if (error) setNotice(error.message);
    else await loadTransactions(walletId);
  }

  const totals = useMemo(() => transactions.reduce((a, t) => {
    if (t.kind === "income") a.income += Number(t.amount);
    else a.expense += Number(t.amount);
    return a;
  }, { income: 0, expense: 0 }), [transactions]);

  const visible = transactions.filter(t =>
    filter === "all" || t.kind === filter
  );

  const monthTransactions = useMemo(() =>
    transactions.filter(t => t.created_at.slice(0, 7) === selectedMonth),
    [transactions, selectedMonth]);

  const monthTotals = useMemo(() => monthTransactions.reduce((a, t) => {
    if (t.kind === "income") a.income += Number(t.amount);
    else a.expense += Number(t.amount);
    return a;
  }, { income: 0, expense: 0 }), [monthTransactions]);

  const monthExpenses = monthTransactions.filter(t => t.kind === "expense");

  const categoryTotals = useMemo(() => {
    const result: Record<string, number> = {};
    monthExpenses.forEach(t => {
      result[t.category] = (result[t.category] || 0) + Number(t.amount);
    });
    return Object.entries(result).sort((a, b) => b[1] - a[1]);
  }, [monthExpenses]);

  const pendingBills = futureBills.filter(b => !b.paid);
  const paidBills = futureBills.filter(b => b.paid);
  const pendingTotal = pendingBills.reduce((sum, b) => sum + Number(b.amount), 0);

  function answerAssistant(question: string) {
    const q = question.toLowerCase();
    let response = "";

    if (q.includes("quanto") || q.includes("resumo") || q.includes("gastei") || q.includes("saldo")) {
      response = `Com base nos ${transactions.length} lançamentos: receitas de ${money(totals.income)}, despesas de ${money(totals.expense)} e saldo líquido de ${money(totals.income - totals.expense)}.`;
    } else if (q.includes("econom") || q.includes("cortar") || q.includes("reduzir")) {
      const byCategory = transactions
        .filter(t => t.kind === "expense")
        .reduce((acc: Record<string, number>, t) => {
          acc[t.category] = (acc[t.category] || 0) + Number(t.amount);
          return acc;
        }, {});

      const biggest = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];

      response = biggest
        ? `A categoria com maior despesa é ${biggest[0]} (${money(biggest[1])}). Vale revisar esses gastos.`
        : "Ainda não há despesas suficientes registradas.";
    } else {
      response = "Posso resumir receitas e despesas, calcular o saldo ou apontar a categoria com maior gasto.";
    }

    setChat(response);
  }

  const monthLabel = new Date(`${selectedMonth}-15T12:00:00`).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric"
  });

  function Header({ title, subtitle }: { title: string; subtitle: string }) {
    return (
      <div className="page-heading">
        <div>
          <div className="eyebrow">DR DIAS / FINANCEIRO</div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <div className="user-chip">
          <span className="user-avatar">✦</span>
          <span>{sessionUser?.email || "Minha família"}</span>
        </div>
      </div>
    );
  }

  function StatCard({
    label,
    value,
    detail,
    tone = "",
    symbol
  }: {
    label: string;
    value: string;
    detail: string;
    tone?: string;
    symbol: string;
  }) {
    return (
      <div className="stat-card">
        <div className="stat-top">
          <span>{label}</span>
          <span className="stat-symbol">{symbol}</span>
        </div>
        <div className={`stat-value ${tone}`}>{value}</div>
        <div className="stat-detail">{detail}</div>
      </div>
    );
  }

  function Empty({ children }: { children: React.ReactNode }) {
    return <div className="empty-state">{children}</div>;
  }

  if (!authReady) {
    return (
      <main className="auth-screen">
        <div className="auth-card">Carregando DR DIAS...</div>
      </main>
    );
  }

  if (!sessionUser) {
    return (
      <main className="auth-screen">
        <section className="auth-card">
          <div className="brand">
            <div className="brandmark">V</div>
            <div>
              <h1>DR DIAS</h1>
              <p>FINANCEIRO FAMILIAR</p>
            </div>
          </div>
          <div className="auth-intro">
            <span className="eyebrow">SEU CONTROLE FINANCEIRO</span>
            <h2>{authMode === "login" ? "Bem-vindo de volta." : "Crie seu acesso."}</h2>
            <p>Organize suas finanças e acompanhe sua carteira familiar em um só lugar.</p>
          </div>
          <form onSubmit={authSubmit} className="form-stack">
            <div className="field">
              <label>E-mail</label>
              <input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@email.com" />
            </div>
            <div className="field">
              <label>Senha</label>
              <input type="password" minLength={6} autoComplete={authMode === "login" ? "current-password" : "new-password"} required value={password} onChange={e => setPassword(e.target.value)} placeholder="Sua senha" />
            </div>
            <button className="primary-btn" disabled={busy}>{busy ? "Aguarde..." : authMode === "login" ? "Entrar na carteira →" : "Criar conta →"}</button>
          </form>
          <button className="text-btn" onClick={() => setAuthMode(authMode === "login" ? "signup" : "login")}>
            {authMode === "login" ? "Primeiro acesso? Criar conta" : "Já tem conta? Entrar"}
          </button>
          {notice && <div className="notice">{notice}</div>}
          {!supabase && <div className="notice">Configure o Supabase seguindo o LEIA-ME.md.</div>}
        </section>
        <style jsx global>{styles}</style>
      </main>
    );
  }

  if (!walletId) {
    return (
      <main className="auth-screen">
        <section className="auth-card">
          <div className="brand">
            <div className="brandmark">V</div>
            <div><h1>DR DIAS</h1><p>FINANCEIRO FAMILIAR</p></div>
          </div>
          <div className="auth-intro">
            <span className="eyebrow">QUASE LÁ</span>
            <h2>Sua carteira familiar</h2>
            <p>Crie a carteira no primeiro usuário. Depois, o segundo usuário entra com o código de convite.</p>
          </div>
          <button className="primary-btn" onClick={createWallet} disabled={busy}>＋ Criar carteira familiar</button>
          <div className="separator"><span>OU ENTRE EM UMA CARTEIRA</span></div>
          <div className="field">
            <label>Código de convite</label>
            <input value={inviteCode} onChange={e => setInviteCode(e.target.value)} placeholder="Ex.: A1B2C3D4" />
          </div>
          <button className="secondary-btn full" onClick={joinWallet} disabled={busy || !inviteCode.trim()}>Entrar em uma carteira existente</button>
          <button className="text-btn" onClick={() => supabase?.auth.signOut()}>Sair da conta</button>
          {notice && <div className="notice">{notice}</div>}
        </section>
        <style jsx global>{styles}</style>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand sidebar-brand">
          <div className="brandmark">V</div>
          <div>
            <h1>DR DIAS</h1>
            <p>FINANCEIRO</p>
          </div>
        </div>

        <div className="nav-caption">MENU PRINCIPAL</div>
        <nav className="navigation">
          {navItems.map(item => (
            <button
              key={item.id}
              className={`nav-item ${activeView === item.id ? "selected" : ""}`}
              onClick={() => { setActiveView(item.id); setNotice(""); }}
            >
              <span className="nav-icon">{item.emoji}</span>
              <span>{item.label}</span>
              {activeView === item.id && <span className="nav-indicator" />}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="wallet-mini">
            <div className="wallet-mini-icon">♡</div>
            <div>
              <strong>Carteira familiar</strong>
              <span>Compartilhada</span>
            </div>
            <span className="online-dot" />
          </div>
          <button className="logout-btn" onClick={() => supabase?.auth.signOut()}>
            <span>↪</span> Sair da conta
          </button>
        </div>
      </aside>

      <section className="main-area">
        <header className="mobile-header">
          <div className="brand">
            <div className="brandmark">V</div>
            <div><h1>DR DIAS</h1><p>FINANCEIRO</p></div>
          </div>
          <button className="mobile-exit" onClick={() => supabase?.auth.signOut()}>Sair</button>
        </header>

        {notice && (
          <div className="notice global-notice">
            <span>ⓘ</span>{notice}
            <button onClick={() => setNotice("")}>×</button>
          </div>
        )}

        {activeView === "home" && (
          <>
            <Header title="Visão geral" subtitle="Aqui está o resumo da sua vida financeira." />

            <section className="welcome-strip">
              <div>
                <span className="eyebrow">SUA CARTEIRA FAMILIAR</span>
                <h2>Suas finanças, sob controle.</h2>
                <p>Um panorama simples e organizado do dinheiro da família.</p>
              </div>
              <div className="welcome-mark">V</div>
            </section>

            <div className="section-title-row">
              <div><h2>Resumo financeiro</h2><p>Todos os lançamentos registrados</p></div>
              <span className="period-pill">VISÃO GERAL</span>
            </div>

            <section className="stats-grid">
              <StatCard label="Saldo líquido" value={money(totals.income - totals.expense)} detail="Receitas menos despesas" tone="white-value" symbol="◈" />
              <StatCard label="Receitas" value={money(totals.income)} detail="Dinheiro que entrou" tone="positive" symbol="↗" />
              <StatCard label="Despesas" value={money(totals.expense)} detail="Dinheiro que saiu" tone="negative" symbol="↘" />
              <StatCard label="Contas pendentes" value={money(pendingTotal)} detail={`${pendingBills.length} contas aguardando pagamento`} symbol="▤" />
            </section>

            <section className="dashboard-grid">
              <div className="surface">
                <div className="surface-heading">
                  <div><h3>Despesas por categoria</h3><p>Distribuição dos gastos deste mês</p></div>
                  <button className="small-link" onClick={() => setActiveView("expenses")}>Ver detalhes →</button>
                </div>
                {categoryTotals.length === 0 ? (
                  <Empty>Nenhuma despesa registrada neste mês.</Empty>
                ) : (
                  <div className="category-preview">
                    {categoryTotals.slice(0, 5).map(([name, value]) => {
                      const percent = monthTotals.expense > 0 ? value / monthTotals.expense * 100 : 0;
                      return (
                        <div className="category-line" key={name}>
                          <div className="category-line-top">
                            <span className="category-name"><span className="category-emoji">{icon(name)}</span>{name}</span>
                            <strong>{money(value)}</strong>
                          </div>
                          <div className="progress-track"><div className="progress-fill" style={{ width: `${percent}%` }} /></div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="surface">
                <div className="surface-heading">
                  <div><h3>Últimas movimentações</h3><p>Atividade recente da carteira</p></div>
                  <button className="small-link" onClick={() => setActiveView("transactions")}>Ver todas →</button>
                </div>
                {transactions.length === 0 ? (
                  <Empty>Nenhum lançamento por enquanto.</Empty>
                ) : (
                  <div className="compact-list">
                    {transactions.slice(0, 5).map(t => (
                      <div className="compact-row" key={t.id}>
                        <div className="compact-icon">{icon(t.category)}</div>
                        <div className="compact-info">
                          <strong>{t.description}</strong>
                          <span>{t.category} · {new Date(t.created_at).toLocaleDateString("pt-BR")}</span>
                        </div>
                        <strong className={t.kind === "income" ? "positive" : "negative"}>
                          {t.kind === "income" ? "+" : "−"}{money(Number(t.amount))}
                        </strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <div className="quick-actions">
              <button className="quick-action" onClick={() => { setKind("expense"); setActiveView("transactions"); }}>
                <span className="quick-icon red-bg">↘</span><span><strong>Nova despesa</strong><small>Registrar um gasto</small></span><b>→</b>
              </button>
              <button className="quick-action" onClick={() => { setKind("income"); setActiveView("transactions"); }}>
                <span className="quick-icon green-bg">↗</span><span><strong>Nova receita</strong><small>Registrar uma entrada</small></span><b>→</b>
              </button>
              <button className="quick-action" onClick={() => setActiveView("bills")}>
                <span className="quick-icon gold-bg">▤</span><span><strong>Contas futuras</strong><small>Organizar pagamentos</small></span><b>→</b>
              </button>
            </div>
          </>
        )}

        {activeView === "expenses" && (
          <>
            <Header title="Despesas" subtitle="Entenda para onde está indo o dinheiro da família." />
            <div className="section-title-row">
              <div><h2>Resumo das despesas</h2><p>Seus gastos separados por categoria</p></div>
              <input className="month-filter" type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} />
            </div>

            <div className="expense-total-card">
              <div>
                <span className="eyebrow">TOTAL DE DESPESAS · {monthLabel.toUpperCase()}</span>
                <div className="expense-total-value">{money(monthTotals.expense)}</div>
                <p>{monthExpenses.length} despesas registradas neste período</p>
              </div>
              <div className="expense-total-icon">↘</div>
            </div>

            <div className="section-title-row compact-heading">
              <div><h2>Onde você gastou</h2><p>Toque nas categorias para identificar seus gastos</p></div>
            </div>

            {categoryTotals.length === 0 ? (
              <div className="surface"><Empty>Não existem despesas neste mês. Quando você registrar gastos, eles aparecerão aqui.</Empty></div>
            ) : (
              <div className="expense-category-grid">
                {categoryTotals.map(([name, value]) => {
                  const percent = monthTotals.expense > 0 ? value / monthTotals.expense * 100 : 0;
                  return (
                    <div className="expense-category-card" key={name}>
                      <div className="expense-category-top">
                        <span className="category-emoji large-emoji">{icon(name)}</span>
                        <span className="category-percent">{percent.toFixed(0)}%</span>
                      </div>
                      <strong>{name}</strong>
                      <div className="expense-category-value">{money(value)}</div>
                      <div className="progress-track"><div className="progress-fill" style={{ width: `${percent}%` }} /></div>
                      <span className="category-hint">do total de despesas</span>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="surface section-gap">
              <div className="surface-heading"><div><h3>Detalhamento dos gastos</h3><p>Despesas registradas no mês selecionado</p></div></div>
              {monthExpenses.length === 0 ? (
                <Empty>Nenhuma despesa para mostrar.</Empty>
              ) : (
                <div className="transaction-list">
                  {monthExpenses.map(t => (
                    <div className="transaction-row" key={t.id}>
                      <div className="transaction-left">
                        <div className="transaction-icon">{icon(t.category)}</div>
                        <div><strong>{t.description}</strong><span>{t.category} · {new Date(t.created_at).toLocaleDateString("pt-BR")}</span></div>
                      </div>
                      <strong className="negative">− {money(Number(t.amount))}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {activeView === "transactions" && (
          <>
            <Header title="Lançamentos" subtitle="Registre e acompanhe tudo que entra e sai." />
            <div className="dashboard-grid">
              <div className="surface">
                <div className="surface-heading"><div><h3>Novo lançamento</h3><p>Adicione uma receita ou despesa</p></div></div>
                <div className="toggle-tabs">
                  <button className={kind === "expense" ? "active expense-tab" : ""} onClick={() => setKind("expense")}>↘ Despesa</button>
                  <button className={kind === "income" ? "active income-tab" : ""} onClick={() => setKind("income")}>↗ Receita</button>
                </div>
                <form onSubmit={addTransaction} className="form-stack">
                  <div className="field">
                    <label>Descrição</label>
                    <input required value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex.: Mercado, salário, aluguel" />
                  </div>
                  <div className="field">
                    <label>Valor (R$)</label>
                    <input required inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0,00" />
                  </div>
                  <div className="field">
                    <label>Categoria</label>
                    <select value={category} onChange={e => setCategory(e.target.value)}>
                      {categories.map(c => <option key={c} value={c}>{icon(c)} {c}</option>)}
                    </select>
                  </div>
                  <button className="primary-btn" disabled={busy}>{busy ? "Salvando..." : "＋ Salvar lançamento"}</button>
                </form>
              </div>

              <div className="surface">
                <div className="surface-heading"><div><h3>Resumo da carteira</h3><p>Totais acumulados</p></div></div>
                <div className="mini-stat"><span>Receitas</span><strong className="positive">{money(totals.income)}</strong></div>
                <div className="mini-stat"><span>Despesas</span><strong className="negative">{money(totals.expense)}</strong></div>
                <div className="mini-stat total-mini"><span>Saldo líquido</span><strong>{money(totals.income - totals.expense)}</strong></div>
              </div>
            </div>

            <div className="surface section-gap">
              <div className="surface-heading"><div><h3>Movimentações</h3><p>{transactions.length} registros na carteira</p></div></div>
              <div className="toggle-tabs filter-tabs">
                <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Todas</button>
                <button className={filter === "income" ? "active income-tab" : ""} onClick={() => setFilter("income")}>Receitas</button>
                <button className={filter === "expense" ? "active expense-tab" : ""} onClick={() => setFilter("expense")}>Despesas</button>
              </div>
              {visible.length === 0 ? (
                <Empty>Ainda não há movimentações.</Empty>
              ) : (
                <div className="transaction-list">
                  {visible.map(t => (
                    <div className="transaction-row" key={t.id}>
                      <div className="transaction-left">
                        <div className="transaction-icon">{icon(t.category)}</div>
                        <div><strong>{t.description}</strong><span>{t.category} · {new Date(t.created_at).toLocaleDateString("pt-BR")}</span></div>
                      </div>
                      <div className="transaction-actions">
                        <strong className={t.kind === "income" ? "positive" : "negative"}>
                          {t.kind === "income" ? "+" : "−"} {money(Number(t.amount))}
                        </strong>
                        <button className="icon-action" title="Editar" onClick={() => editTransaction(t)}>✎</button>
                        <button className="icon-action danger-action" title="Excluir" onClick={() => deleteTransaction(t.id)}>×</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {activeView === "bills" && (
          <>
            <Header title="Contas futuras" subtitle="Planeje os próximos pagamentos sem mexer no saldo antes da hora." />
            <section className="stats-grid bills-stats">
              <StatCard label="Contas pendentes" value={String(pendingBills.length)} detail="Aguardando pagamento" symbol="▤" />
              <StatCard label="Valor previsto" value={money(pendingTotal)} detail="Ainda não descontado do saldo" tone="white-value" symbol="◈" />
              <StatCard label="Contas pagas" value={String(paidBills.length)} detail="Pagamentos confirmados" tone="positive" symbol="✓" />
            </section>

            <div className="dashboard-grid">
              <div className="surface">
                <div className="surface-heading"><div><h3>Cadastrar conta</h3><p>Adicione um pagamento futuro</p></div></div>
                <form onSubmit={addFutureBill} className="form-stack">
                  <div className="field"><label>Nome da conta</label><input required value={billDescription} onChange={e => setBillDescription(e.target.value)} placeholder="Ex.: Conta de luz, internet, aluguel" /></div>
                  <div className="field"><label>Valor (R$)</label><input required inputMode="decimal" value={billAmount} onChange={e => setBillAmount(e.target.value)} placeholder="0,00" /></div>
                  <div className="field"><label>Vencimento</label><input type="date" required value={billDueDate} onChange={e => setBillDueDate(e.target.value)} /></div>
                  <div className="field">
                    <label>Categoria</label>
                    <select value={billCategory} onChange={e => setBillCategory(e.target.value)}>
                      {categories.filter(c => c !== "Salário").map(c => <option key={c} value={c}>{icon(c)} {c}</option>)}
                    </select>
                  </div>
                  <button className="primary-btn" disabled={busy}>{busy ? "Salvando..." : "＋ Cadastrar conta"}</button>
                </form>
              </div>

              <div className="surface">
                <div className="surface-heading"><div><h3>Contas pendentes</h3><p>Confirme somente depois de pagar</p></div><span className="count-pill">{pendingBills.length}</span></div>
                {pendingBills.length === 0 ? <Empty>Nenhuma conta pendente.</Empty> : (
                  <div className="bill-list">
                    {pendingBills.map(b => (
                      <div className="bill-row" key={b.id}>
                        <div className="transaction-icon">{icon(b.category)}</div>
                        <div className="bill-info">
                          <strong>{b.description}</strong>
                          <span>{b.category} · Vence {new Date(`${b.due_date}T12:00:00`).toLocaleDateString("pt-BR")}</span>
                          {b.due_date < today() && <em>VENCIDA</em>}
                          <strong className="bill-amount">{money(Number(b.amount))}</strong>
                          <div className="bill-actions">
                            <button className="mini-primary" disabled={busy} onClick={() => payFutureBill(b)}>Marcar como paga</button>
                            <button className="mini-delete" onClick={() => deleteFutureBill(b.id)}>Excluir</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="surface section-gap">
              <div className="surface-heading"><div><h3>Contas pagas</h3><p>Pagamentos já registrados no financeiro</p></div><span className="count-pill">{paidBills.length}</span></div>
              {paidBills.length === 0 ? <Empty>Nenhuma conta paga por enquanto.</Empty> : (
                <div className="transaction-list">
                  {paidBills.map(b => (
                    <div className="transaction-row" key={b.id}>
                      <div className="transaction-left">
                        <div className="transaction-icon">{icon(b.category)}</div>
                        <div><strong>{b.description}</strong><span>{b.category} · Paga em {b.paid_at ? new Date(b.paid_at).toLocaleDateString("pt-BR") : "data não informada"}</span></div>
                      </div>
                      <strong className="positive">{money(Number(b.amount))} · Paga ✓</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {activeView === "history" && (
          <>
            <Header title="Histórico mensal" subtitle="Consulte os resultados financeiros de cada mês." />
            <div className="section-title-row">
              <div><h2>Escolha o período</h2><p>Veja o que entrou e saiu da carteira</p></div>
              <input className="month-filter" type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} />
            </div>
            <section className="stats-grid">
              <StatCard label="Receitas do mês" value={money(monthTotals.income)} detail={monthLabel} tone="positive" symbol="↗" />
              <StatCard label="Despesas do mês" value={money(monthTotals.expense)} detail={monthLabel} tone="negative" symbol="↘" />
              <StatCard label="Resultado do mês" value={money(monthTotals.income - monthTotals.expense)} detail="Receitas menos despesas" tone="white-value" symbol="◈" />
            </section>
            <div className="surface section-gap">
              <div className="surface-heading"><div><h3>Movimentações de {monthLabel}</h3><p>{monthTransactions.length} registros encontrados</p></div></div>
              {monthTransactions.length === 0 ? <Empty>Não há movimentações neste mês.</Empty> : (
                <div className="transaction-list">
                  {monthTransactions.map(t => (
                    <div className="transaction-row" key={t.id}>
                      <div className="transaction-left">
                        <div className="transaction-icon">{icon(t.category)}</div>
                        <div><strong>{t.description}</strong><span>{t.category} · {new Date(t.created_at).toLocaleDateString("pt-BR")}</span></div>
                      </div>
                      <strong className={t.kind === "income" ? "positive" : "negative"}>
                        {t.kind === "income" ? "+" : "−"} {money(Number(t.amount))}
                      </strong>
                    </div>
                  ))}
                </div>
              )}
              <p className="footnote">O histórico considera a data em que cada lançamento foi registrado. Contas futuras entram no histórico somente depois de pagas.</p>
            </div>
          </>
        )}

        {activeView === "assistant" && (
          <>
            <Header title="Assistente IA" subtitle="Consulte seus dados e receba um resumo da carteira." />
            <div className="assistant-panel">
              <div className="assistant-orb">✧</div>
              <span className="eyebrow">ASSISTENTE FINANCEIRO</span>
              <h2>Como posso ajudar?</h2>
              <p>Faça uma pergunta sobre suas receitas, despesas ou saldo.</p>
              <div className="chatbubble">{chat}</div>
              <form className="assistant-input" onSubmit={e => { e.preventDefault(); if (message.trim()) { answerAssistant(message); setMessage(""); } }}>
                <input value={message} onChange={e => setMessage(e.target.value)} placeholder="Ex.: Onde estamos gastando mais?" />
                <button className="primary-btn" type="submit">Enviar →</button>
              </form>
              <div className="suggestion-row">
                <button onClick={() => answerAssistant("Faça um resumo das minhas finanças")}>Resumo financeiro</button>
                <button onClick={() => answerAssistant("Onde posso economizar?")}>Onde economizar?</button>
                <button onClick={() => answerAssistant("Quanto temos de saldo?")}>Quanto temos de saldo?</button>
              </div>
              <p className="footnote">Assistente inicial baseado nos lançamentos registrados. As respostas são resumos simples dos seus dados.</p>
            </div>
          </>
        )}

        {activeView === "family" && (
          <>
            <Header title="Carteira familiar" subtitle="Seu espaço financeiro compartilhado." />
            <div className="family-card">
              <div className="family-heart">♡</div>
              <span className="eyebrow">FINANÇAS EM FAMÍLIA</span>
              <h2>Uma carteira, duas pessoas.</h2>
              <p>Você e Hemily podem consultar as mesmas movimentações e contas futuras usando a carteira compartilhada.</p>
              <div className="family-status"><span className="online-dot" /> Carteira conectada</div>
            </div>
            <div className="surface section-gap">
              <div className="surface-heading"><div><h3>Seu acesso</h3><p>Conta atualmente conectada</p></div></div>
              <div className="profile-row"><span className="profile-avatar">✦</span><div><strong>{sessionUser.email}</strong><span>Usuário da carteira familiar</span></div></div>
              <button className="secondary-btn" onClick={() => supabase?.auth.signOut()}>Sair da conta</button>
            </div>
            <div className="surface section-gap">
              <div className="surface-heading"><div><h3>Compartilhamento</h3><p>Convide o outro usuário para a carteira</p></div></div>
              <p className="muted-text">Consulte o código de convite no Supabase, na tabela wallets, coluna invite_code. O segundo usuário pode utilizá-lo na tela de entrada da carteira.</p>
            </div>
          </>
        )}

        <footer className="app-footer">
          <span>DR DIAS FINANCEIRO</span>
          <span>Seus dados pertencem à sua família.</span>
        </footer>
      </section>

      <style jsx global>{styles}</style>
    </main>
  );
}

const styles = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap');

:root {
  color-scheme: dark;
  --bg: #0b0e0d;
  --panel: #121715;
  --panel-2: #171e1a;
  --border: #26312b;
  --text: #f0f4f0;
  --muted: #89968d;
  --green: #9ce5b1;
  --green-dark: #1b3a29;
  --red: #f19b9b;
  --gold: #d7c18c;
}

* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: var(--bg); color: var(--text); font-family: 'DM Sans', sans-serif; }
body { min-height: 100vh; }
button, input, select { font: inherit; }
button { cursor: pointer; }
button:disabled { opacity: .55; cursor: not-allowed; }

.app-shell { min-height: 100vh; display: flex; background: var(--bg); }
.sidebar { width: 250px; flex: 0 0 250px; background: #0e1310; border-right: 1px solid #202a23; padding: 30px 17px 20px; display: flex; flex-direction: column; min-height: 100vh; position: sticky; top: 0; height: 100vh; }
.brand { display: flex; align-items: center; gap: 12px; }
.brandmark { width: 42px; height: 42px; display: grid; place-items: center; border-radius: 13px; background: #b4e7bf; color: #102016; font: 800 24px 'Manrope', sans-serif; box-shadow: 0 6px 24px #9ce5b122; }
.brand h1 { font: 800 16px 'Manrope', sans-serif; letter-spacing: 2px; margin: 0; }
.brand p { margin: 3px 0 0; font-size: 9px; color: #8d9a91; letter-spacing: 2.3px; }
.sidebar-brand { padding: 0 9px 42px; }
.nav-caption, .eyebrow { font-size: 9px; font-weight: 700; color: #839188; letter-spacing: 1.7px; }
.nav-caption { padding: 0 12px 13px; }
.navigation { display: flex; flex-direction: column; gap: 5px; }
.nav-item { border: 0; border-radius: 10px; background: transparent; color: #a0aca3; padding: 12px 13px; display: flex; align-items: center; gap: 12px; text-align: left; font-size: 12px; position: relative; transition: .2s; }
.nav-item:hover { background: #18221b; color: #fff; }
.nav-item.selected { background: #1b2b20; color: #c1f0ca; }
.nav-icon { width: 19px; text-align: center; font-size: 18px; color: #a8c9af; }
.nav-indicator { position: absolute; right: 0; width: 3px; height: 22px; background: #9ce5b1; border-radius: 5px 0 0 5px; }
.sidebar-bottom { margin-top: auto; }
.wallet-mini { display: flex; align-items: center; gap: 9px; padding: 13px 10px; border: 1px solid #29362d; background: #141c17; border-radius: 12px; }
.wallet-mini-icon { width: 31px; height: 31px; border-radius: 9px; display: grid; place-items: center; background: #24392a; color: #b8e7c2; font-size: 19px; }
.wallet-mini strong, .wallet-mini span { display: block; }
.wallet-mini strong { font-size: 10px; }
.wallet-mini div:nth-child(2) span { color: #829087; font-size: 9px; margin-top: 3px; }
.online-dot { width: 7px; height: 7px; background: #79d99a; border-radius: 50%; margin-left: auto; box-shadow: 0 0 10px #79d99a66; }
.logout-btn { margin-top: 12px; width: 100%; border: 0; background: transparent; color: #8e9b91; text-align: left; padding: 12px; font-size: 11px; }
.logout-btn span { margin-right: 9px; font-size: 17px; }
.main-area { width: calc(100% - 250px); max-width: 1600px; margin: 0 auto; padding: 38px 46px 25px; min-width: 0; }
.page-heading { display: flex; justify-content: space-between; align-items: center; gap: 15px; margin-bottom: 30px; }
.page-heading h1 { margin: 8px 0 5px; font: 800 27px 'Manrope', sans-serif; letter-spacing: -.8px; }
.page-heading p { color: var(--muted); font-size: 12px; margin: 0; }
.user-chip { display: flex; align-items: center; gap: 9px; border: 1px solid var(--border); border-radius: 30px; padding: 7px 13px 7px 7px; color: #b8c5bc; font-size: 10px; max-width: 250px; overflow: hidden; }
.user-chip > span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.user-avatar { width: 29px; height: 29px; display: grid; place-items: center; border-radius: 50%; background: #273d2d; color: #bce9c5; font-size: 16px; }
.mobile-header { display: none; }
.welcome-strip { background: linear-gradient(110deg, #17251b, #142019 62%, #1b2b20); border: 1px solid #304638; border-radius: 16px; padding: 25px 29px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 29px; overflow: hidden; position: relative; }
.welcome-strip h2 { font: 700 20px 'Manrope', sans-serif; margin: 9px 0 5px; }
.welcome-strip p { margin: 0; color: #9caea1; font-size: 11px; }
.welcome-mark { font: 800 100px 'Manrope', sans-serif; line-height: 1; color: #b9edc51b; padding-right: 25px; }
.section-title-row { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin: 27px 0 14px; }
.section-title-row h2 { font: 700 15px 'Manrope', sans-serif; margin: 0 0 4px; }
.section-title-row p { color: var(--muted); font-size: 10px; margin: 0; }
.period-pill, .count-pill { border: 1px solid #344239; border-radius: 30px; padding: 7px 11px; color: #a8c9ae; font-size: 9px; letter-spacing: 1px; }
.stats-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 13px; }
.stat-card { background: var(--panel); border: 1px solid var(--border); border-radius: 13px; padding: 18px; min-width: 0; }
.stat-top { display: flex; justify-content: space-between; align-items: center; color: #98a49b; font-size: 10px; }
.stat-symbol { width: 28px; height: 28px; display: grid; place-items: center; border-radius: 9px; background: #202b24; color: #b6dfbf; font-size: 16px; }
.stat-value { font: 700 19px 'Manrope', sans-serif; margin-top: 16px; letter-spacing: -.6px; overflow-wrap: anywhere; }
.stat-detail { color: #77857b; font-size: 9px; margin-top: 6px; }
.positive { color: var(--green) !important; }
.negative { color: var(--red) !important; }
.white-value { color: #edf4ee; }
.dashboard-grid { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, .9fr); gap: 15px; margin-top: 18px; }
.surface { background: var(--panel); border: 1px solid var(--border); border-radius: 14px; padding: 21px; min-width: 0; }
.surface-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 19px; }
.surface-heading h3 { font: 700 13px 'Manrope', sans-serif; margin: 0 0 5px; }
.surface-heading p { color: var(--muted); font-size: 10px; margin: 0; }
.small-link { border: 0; background: transparent; color: #a9d9b4; font-size: 10px; white-space: nowrap; }
.category-preview { display: flex; flex-direction: column; gap: 17px; }
.category-line-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; font-size: 10px; }
.category-line-top strong { font-size: 10px; }
.category-name { display: flex; align-items: center; gap: 8px; color: #cbd4cd; }
.category-emoji { width: 29px; height: 29px; display: inline-grid; place-items: center; border-radius: 9px; background: #202a23; font-size: 15px; }
.progress-track { height: 5px; background: #263029; border-radius: 20px; overflow: hidden; }
.progress-fill { height: 100%; background: linear-gradient(90deg, #70c58b, #b2e6bd); border-radius: 20px; min-width: 2px; }
.compact-list { display: flex; flex-direction: column; }
.compact-row { display: flex; align-items: center; gap: 10px; padding: 11px 0; border-bottom: 1px solid #222d26; min-width: 0; }
.compact-row:last-child { border-bottom: 0; }
.compact-icon, .transaction-icon { flex: 0 0 auto; width: 36px; height: 36px; display: grid; place-items: center; background: #202b24; border-radius: 11px; font-size: 17px; }
.compact-info { flex: 1; min-width: 0; }
.compact-info strong, .compact-info span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.compact-info strong { font-size: 10px; color: #e0e8e1; }
.compact-info span { font-size: 9px; color: #7f8d83; margin-top: 4px; }
.compact-row > strong { font-size: 10px; white-space: nowrap; }
.quick-actions { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 15px; }
.quick-action { display: flex; align-items: center; gap: 11px; text-align: left; padding: 14px; border: 1px solid var(--border); background: #111714; border-radius: 12px; color: var(--text); }
.quick-action > span:nth-child(2) { flex: 1; }
.quick-action strong, .quick-action small { display: block; }
.quick-action strong { font-size: 10px; }
.quick-action small { color: #819087; font-size: 9px; margin-top: 4px; }
.quick-action b { color: #9fbaaa; font-weight: 400; }
.quick-icon { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 10px; font-size: 17px; }
.red-bg { background: #382323; color: #f19b9b; }
.green-bg { background: #20372a; color: #9ce5b1; }
.gold-bg { background: #373124; color: #e4cd91; }
.month-filter { border: 1px solid #344238; background: #151d18; border-radius: 9px; color: #e1eae2; padding: 9px 11px; font-size: 11px; }
.expense-total-card { display: flex; align-items: center; justify-content: space-between; padding: 25px 28px; border: 1px solid #473131; border-radius: 15px; background: linear-gradient(110deg, #241919, #171514); }
.expense-total-value { font: 800 31px 'Manrope', sans-serif; color: #f0aaaa; margin: 9px 0 4px; }
.expense-total-card p { margin: 0; font-size: 10px; color: #a88f8f; }
.expense-total-icon { width: 54px; height: 54px; display: grid; place-items: center; border-radius: 16px; background: #422727; color: #f2aaaa; font-size: 27px; }
.compact-heading { margin-top: 27px; }
.expense-category-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 13px; }
.expense-category-card { background: var(--panel); border: 1px solid var(--border); border-radius: 13px; padding: 17px; min-width: 0; }
.expense-category-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
.large-emoji { width: 40px; height: 40px; font-size: 20px; }
.category-percent { font-size: 10px; color: #a6c9ad; }
.expense-category-card > strong { font-size: 11px; display: block; }
.expense-category-value { font: 700 16px 'Manrope', sans-serif; margin: 7px 0 13px; overflow-wrap: anywhere; }
.category-hint { display: block; color: #77857b; font-size: 9px; margin-top: 7px; }
.section-gap { margin-top: 17px; }
.transaction-list { display: flex; flex-direction: column; }
.transaction-row { display: flex; align-items: center; justify-content: space-between; gap: 13px; padding: 12px 0; border-bottom: 1px solid #253028; min-width: 0; }
.transaction-row:last-child { border-bottom: 0; }
.transaction-left { display: flex; align-items: center; gap: 11px; min-width: 0; }
.transaction-left > div:last-child { min-width: 0; }
.transaction-left strong, .transaction-left span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.transaction-left strong { font-size: 11px; }
.transaction-left span { color: #819087; font-size: 9px; margin-top: 4px; }
.transaction-row > strong { font-size: 11px; white-space: nowrap; }
.transaction-actions { display: flex; align-items: center; gap: 10px; }
.transaction-actions > strong { font-size: 10px; white-space: nowrap; }
.icon-action { border: 1px solid #354139; color: #b5c5b8; background: #18211b; border-radius: 7px; width: 27px; height: 27px; font-size: 14px; }
.danger-action { color: #e99b9b; }
.toggle-tabs { display: flex; gap: 6px; background: #0e1310; border: 1px solid #273229; border-radius: 10px; padding: 4px; margin-bottom: 18px; }
.toggle-tabs button { flex: 1; border: 0; border-radius: 7px; padding: 10px; color: #91a095; background: transparent; font-size: 10px; }
.toggle-tabs button.active { background: #27342b; color: #d4e9d8; }
.toggle-tabs button.expense-tab.active { background: #382626; color: #f0b1b1; }
.toggle-tabs button.income-tab.active { background: #203a2a; color: #a7e4b6; }
.filter-tabs { max-width: 360px; }
.form-stack { display: flex; flex-direction: column; gap: 13px; }
.field { display: flex; flex-direction: column; gap: 7px; }
.field label { font-size: 10px; color: #a3b0a6; }
.field input, .field select, .assistant-input input { width: 100%; border: 1px solid #303d34; border-radius: 9px; padding: 12px 13px; background: #0d130f; color: #e7eee8; outline: none; font-size: 11px; min-width: 0; }
.field input:focus, .field select:focus, .assistant-input input:focus { border-color: #75b888; box-shadow: 0 0 0 2px #75b88818; }
.primary-btn { border: 1px solid #a6e3b4; border-radius: 9px; background: #a6e3b4; color: #102016; padding: 12px 16px; font-weight: 700; font-size: 11px; transition: .2s; }
.primary-btn:hover { background: #c1f0ca; }
.secondary-btn { border: 1px solid #405248; border-radius: 9px; background: #1a251e; color: #c2ddc8; padding: 11px 15px; font-size: 11px; }
.full { width: 100%; }
.mini-stat { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 17px 0; border-bottom: 1px solid #28332b; font-size: 11px; color: #9ba89e; }
.mini-stat strong { font: 700 14px 'Manrope', sans-serif; }
.total-mini { color: #edf4ee; border: 0; padding-bottom: 0; }
.bill-list { display: flex; flex-direction: column; gap: 15px; }
.bill-row { display: flex; align-items: flex-start; gap: 11px; padding: 13px; border: 1px solid #2b372e; border-radius: 11px; background: #111814; }
.bill-info { flex: 1; min-width: 0; }
.bill-info > strong, .bill-info > span { display: block; }
.bill-info > strong:first-child { font-size: 11px; }
.bill-info > span { color: #849187; font-size: 9px; margin-top: 5px; }
.bill-info em { display: inline-block; color: #f1a2a2; font-size: 8px; font-style: normal; margin-top: 5px; }
.bill-amount { font: 700 14px 'Manrope', sans-serif; margin-top: 9px; }
.bill-actions { display: flex; align-items: center; gap: 12px; margin-top: 10px; }
.mini-primary, .mini-delete { border: 0; border-radius: 7px; padding: 8px 10px; font-size: 9px; }
.mini-primary { background: #a6e3b4; color: #102016; font-weight: 700; }
.mini-delete { color: #e9a0a0; background: #342323; }
.footnote { color: #78877d; font-size: 9px; line-height: 1.6; margin: 17px 0 0; }
.assistant-panel { max-width: 760px; margin: 20px auto; padding: 35px; border: 1px solid #2c3c30; background: radial-gradient(circle at 50% 0%, #203b29, #121916 55%); border-radius: 18px; text-align: center; }
.assistant-orb { width: 58px; height: 58px; margin: 0 auto 18px; display: grid; place-items: center; background: #2a4933; border: 1px solid #577b5e; border-radius: 18px; color: #b9edc4; font-size: 30px; }
.assistant-panel h2 { font: 800 23px 'Manrope', sans-serif; margin: 9px 0; }
.assistant-panel > p { color: #99a99d; font-size: 11px; }
.chatbubble { margin: 25px 0 15px; padding: 17px; background: #101713; border: 1px solid #2c3a30; border-radius: 12px; text-align: left; color: #d2dfd5; font-size: 11px; line-height: 1.7; }
.assistant-input { display: flex; gap: 8px; }
.assistant-input input { flex: 1; }
.suggestion-row { display: flex; justify-content: center; flex-wrap: wrap; gap: 7px; margin-top: 15px; }
.suggestion-row button { border: 1px solid #34463a; background: #18251c; color: #b9d4bf; border-radius: 30px; padding: 8px 11px; font-size: 9px; }
.family-card { background: linear-gradient(120deg, #1b3022, #121a15); border: 1px solid #354b39; border-radius: 16px; padding: 29px; }
.family-heart { width: 48px; height: 48px; display: grid; place-items: center; border-radius: 14px; background: #2b4531; color: #bce9c5; font-size: 26px; margin-bottom: 20px; }
.family-card h2 { font: 800 23px 'Manrope', sans-serif; margin: 9px 0; }
.family-card p, .muted-text { color: #a0ada3; font-size: 11px; line-height: 1.7; max-width: 560px; }
.family-status { display: inline-flex; align-items: center; gap: 8px; margin-top: 13px; border: 1px solid #3d5b43; border-radius: 30px; padding: 8px 12px; color: #b9e7c2; font-size: 10px; }
.profile-row { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
.profile-avatar { width: 39px; height: 39px; display: grid; place-items: center; border-radius: 50%; background: #263d2c; color: #b9e7c2; }
.profile-row strong, .profile-row span { display: block; }
.profile-row strong { font-size: 11px; }
.profile-row div span { color: #819087; font-size: 9px; margin-top: 4px; }
.empty-state { padding: 27px 12px; text-align: center; color: #819087; font-size: 10px; border: 1px dashed #344238; border-radius: 10px; }
.app-footer { display: flex; justify-content: space-between; gap: 10px; color: #637168; font-size: 9px; letter-spacing: .4px; padding: 30px 3px 5px; }
.notice { background: #332d1d; border: 1px solid #665632; color: #f0dba6; border-radius: 9px; padding: 11px 13px; font-size: 10px; line-height: 1.5; margin-top: 12px; }
.global-notice { display: flex; gap: 9px; align-items: center; margin-bottom: 18px; }
.global-notice button { margin-left: auto; border: 0; background: transparent; color: #f0dba6; font-size: 17px; }
.auth-screen { min-height: 100vh; display: grid; place-items: center; padding: 25px; background: radial-gradient(circle at 50% 0%, #1b3021, #0b0e0d 50%); }
.auth-card { width: 100%; max-width: 420px; border: 1px solid #2d3c31; border-radius: 18px; padding: 32px; background: #121916; box-shadow: 0 25px 90px #0006; }
.auth-intro { margin: 37px 0 25px; }
.auth-intro h2 { font: 800 25px 'Manrope', sans-serif; margin: 9px 0; }
.auth-intro p { color: #93a096; font-size: 11px; line-height: 1.7; }
.text-btn { display: block; margin: 17px auto 0; border: 0; background: transparent; color: #a9dcb4; font-size: 10px; }
.separator { display: flex; align-items: center; gap: 12px; color: #77857b; font-size: 8px; letter-spacing: 1px; margin: 22px 0; }
.separator:before, .separator:after { content: ''; height: 1px; flex: 1; background: #2a352d; }

@media (max-width: 1100px) {
  .main-area { padding: 30px 25px; }
  .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .expense-category-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 760px) {
  .app-shell { display: block; padding-bottom: 72px; }
  .sidebar { display: none; }
  .main-area { width: 100%; padding: 17px 15px 25px; }
  .mobile-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 26px; }
  .mobile-header .brandmark { width: 35px; height: 35px; font-size: 20px; }
  .mobile-header .brand h1 { font-size: 13px; }
  .mobile-header .brand p { font-size: 8px; }
  .mobile-exit { border: 1px solid #354238; border-radius: 8px; background: #172019; color: #b8c8bb; padding: 8px 12px; font-size: 10px; }
  .page-heading { margin-bottom: 22px; }
  .page-heading h1 { font-size: 23px; }
  .user-chip { display: none; }
  .welcome-strip { padding: 20px; }
  .welcome-strip h2 { font-size: 17px; }
  .welcome-mark { font-size: 70px; padding-right: 0; }
  .stats-grid { gap: 9px; }
  .stat-card { padding: 13px; }
  .stat-value { font-size: 16px; margin-top: 12px; }
  .stat-detail { line-height: 1.5; }
  .dashboard-grid { grid-template-columns: 1fr; gap: 11px; }
  .surface { padding: 16px; }
  .quick-actions { grid-template-columns: 1fr; }
  .expense-category-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; }
  .expense-category-card { padding: 13px; }
  .expense-category-value { font-size: 14px; }
  .section-title-row { align-items: flex-end; }
  .month-filter { max-width: 145px; }
  .transaction-row { align-items: flex-start; }
  .transaction-actions { flex-wrap: wrap; justify-content: flex-end; }
  .transaction-actions > strong { width: 100%; text-align: right; }
  .assistant-panel { padding: 22px 15px; }
  .assistant-input { flex-direction: column; }
  .assistant-input .primary-btn { width: 100%; }
  .app-footer { flex-direction: column; text-align: center; }
  .bills-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }

@media (max-width: 390px) {
  .expense-category-grid { grid-template-columns: 1fr 1fr; }
  .stat-value { font-size: 14px; }
  .page-heading h1 { font-size: 21px; }
}

/* ===== DR DIAS - VAULT DESIGN ===== */

:root {
  --bg: #090d0b;
  --panel: #101713;
  --panel-2: #17221b;
  --border: #26372c;
  --green: #a5edb7;
  --green-dark: #1b3926;
}

.main-area {
  max-width: 1700px;
  padding-top: 34px;
}

.sidebar {
  background: #0b100d;
  border-right-color: #1c2920;
}

.brandmark {
  background: linear-gradient(145deg, #c2f5cd, #79c990);
  box-shadow: 0 5px 25px #80d99b25;
}

.nav-item {
  padding: 13px;
  border-radius: 11px;
  transition: background .2s, transform .2s;
}

.nav-item:hover {
  transform: translateX(2px);
}

.nav-item.selected {
  background: linear-gradient(100deg, #1c3323, #17251b);
  box-shadow: inset 2px 0 #a5edb7;
}

.welcome-strip {
  background:
    radial-gradient(circle at 85% 20%, #315c3b55, transparent 35%),
    linear-gradient(115deg, #17291d, #101a14);
  border-color: #34523b;
  padding: 30px;
  min-height: 155px;
}

.welcome-strip h2 {
  font-size: 23px;
  letter-spacing: -.7px;
}

.welcome-mark {
  font-size: 115px;
  color: #b9edc51a;
}

.stat-card {
  background: linear-gradient(145deg, #151e18, #0f1511);
  border-color: #283a2e;
  padding: 21px;
  transition: border-color .2s, transform .2s;
}

.stat-card:hover,
.surface:hover {
  border-color: #405b46;
}

.stat-value {
  font-size: 21px;
  letter-spacing: -.8px;
}

.stat-symbol {
  background: #203728;
  color: #b7efc3;
}

.dashboard-grid {
  gap: 17px;
}

.surface {
  background: linear-gradient(145deg, #131b16, #101612);
  border-color: #28382e;
  border-radius: 16px;
  transition: border-color .2s;
}

.surface-heading {
  margin-bottom: 22px;
}

.surface-heading h3 {
  font-size: 14px;
}

.category-emoji,
.compact-icon,
.transaction-icon {
  background: #1c2b21;
  border: 1px solid #2a4030;
}

.progress-track {
  background: #26332a;
  height: 6px;
}

.progress-fill {
  background: linear-gradient(90deg, #65bd7d, #b0efbd);
  box-shadow: 0 0 12px #8de3a344;
}

.quick-action {
  background: linear-gradient(145deg, #151e18, #101612);
  border-color: #2a3b30;
  border-radius: 13px;
  transition: .2s;
}

.quick-action:hover {
  border-color: #6caa7b;
  transform: translateY(-2px);
}

.primary-btn {
  background: linear-gradient(135deg, #b8efc4, #8ddba1);
  border-color: #b8efc4;
  box-shadow: 0 5px 18px #8cdda122;
}

.primary-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 7px 22px #8cdda133;
}

.field input,
.field select,
.assistant-input input {
  background: #0b110d;
  border-color: #2b3d31;
  border-radius: 10px;
}

.expense-category-card {
  background: linear-gradient(145deg, #151e18, #101612);
  border-color: #293b2e;
  border-radius: 15px;
}

.transaction-row {
  padding: 15px 0;
}

.bill-row {
  background: #121a15;
  border-color: #2b3c30;
  border-radius: 13px;
}

.page-heading h1 {
  letter-spacing: -1px;
}

.period-pill {
  background: #18251c;
}

.app-footer {
  border-top: 1px solid #1d2a21;
  margin-top: 28px;
  padding-top: 20px;
}

@media (max-width: 760px) {
  .welcome-strip {
    min-height: 135px;
    padding: 20px;
  }

  .welcome-strip h2 {
    font-size: 18px;
  }

  .welcome-mark {
    font-size: 75px;
  }

  .stat-card {
    padding: 14px;
  }
}
`;
