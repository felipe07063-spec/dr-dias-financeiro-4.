
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

/* ===== DR DIAS - TEMA CLARO ===== */

:root {
  --bg: #F5F7F5;
  --panel: #FFFFFF;
  --panel-2: #E8F1EA;
  --border: #E5EAE6;
  --text: #25382C;
  --muted: #7A857D;
  --green: #39865A;
  --green-dark: #E8F1EA;
  --red: #D45D5D;
  --gold: #B99145;
}

.sidebar,
.surface,
.stat-card,
.expense-category-card,
.quick-action,
.bill-row,
.wallet-mini {
  background: #FFFFFF;
  border-color: var(--border);
}

.sidebar {
  background: #FFFFFF;
}

.welcome-strip,
.family-card,
.assistant-panel,
.auth-screen {
  background: #E8F1EA;
  border-color: var(--border);
  color: var(--text);
}

.welcome-strip p,
.family-card p,
.assistant-panel > p,
.auth-intro p {
  color: var(--muted);
}

.welcome-mark {
  color: #39865A22;
}

.user-chip,
.period-pill,
.count-pill,
.month-filter {
  background: #FFFFFF;
  border-color: var(--border);
  color: var(--text);
}

.stat-top,
.category-name,
.compact-info strong,
.transaction-left strong,
.field label {
  color: var(--text);
}

.stat-symbol,
.category-emoji,
.compact-icon,
.transaction-icon,
.quick-icon,
.wallet-mini-icon,
.family-heart,
.assistant-orb,
.profile-avatar {
  background: #E8F1EA;
  color: #39865A;
  border-color: var(--border);
}

.progress-track {
  background: #E5EAE6;
}

.progress-fill {
  background: linear-gradient(90deg, #39865A, #8DBD9A);
}

.compact-row,
.transaction-row,
.mini-stat {
  border-color: var(--border);
}

.quick-action:hover,
.surface:hover,
.stat-card:hover {
  border-color: #39865A;
}

.small-link,
.text-btn {
  color: #39865A;
}

.primary-btn,
.mini-primary {
  background: #39865A;
  border-color: #39865A;
  color: #FFFFFF;
}

.secondary-btn,
.icon-action,
.mobile-exit,
.suggestion-row button {
  background: #E8F1EA;
  border-color: var(--border);
  color: #39865A;
}

.field input,
.field select,
.assistant-input input {
  background: #FFFFFF;
  color: var(--text);
  border-color: var(--border);
}

.toggle-tabs {
  background: #F0F4F0;
  border-color: var(--border);
}

.toggle-tabs button {
  color: var(--muted);
}

.toggle-tabs button.active,
.toggle-tabs button.income-tab.active {
  background: #E8F1EA;
  color: #39865A;
}

.expense-total-card {
  background: #F9EEEE;
  border-color: #F0DADA;
}

.expense-total-value {
  color: #D45D5D;
}

.expense-total-icon {
  background: #F5DEDE;
  color: #D45D5D;
}

.assistant-panel {
  background: #FFFFFF;
}

.chatbubble {
  background: #F5F7F5;
  border-color: var(--border);
  color: var(--text);
}

.family-status {
  background: #E8F1EA;
  border-color: var(--border);
  color: #39865A;
}

.empty-state {
  border-color: var(--border);
  color: var(--muted);
}

.app-footer {
  border-color: var(--border);
  color: var(--muted);
}

.notice,
.global-notice {
  background: #FFF8E8;
  border-color: #EADDBB;
  color: #80652D;
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
