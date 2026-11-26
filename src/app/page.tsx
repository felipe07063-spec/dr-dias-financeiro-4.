
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
  const [chat, setChat] = useState("Olá! Sou o assistente do DR DIAS. Posso resumir seus lançamentos e ajudar a planejar seu orçamento.");
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
    [transactions, selectedMonth]
  );

  const monthTotals = useMemo(() => monthTransactions.reduce((a, t) => {
    if (t.kind === "income") a.income += Number(t.amount);
    else a.expense += Number(t.amount);
    return a;
  }, { income: 0, expense: 0 }), [monthTransactions]);

  const pendingBills = futureBills.filter(b => !b.paid);
  const paidBills = futureBills.filter(b => b.paid);

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

  if (!authReady) {
    return <main className="shell"><div className="panel">Carregando DR DIAS...</div></main>;
  }

  if (!sessionUser) {
    return <main className="shell">
      <section className="panel auth">
        <div className="brand"><div className="brandmark">✦</div><div><h1>DR DIAS</h1><p>FINANCEIRO IA</p></div></div>
        <h2 style={{ marginTop: 28 }}>{authMode === "login" ? "Acesse sua carteira" : "Criar seu acesso"}</h2>
        <p>Entre com seu e-mail e senha. Os dois usuários terão acesso à mesma carteira familiar.</p>
        <form onSubmit={authSubmit}>
          <div className="field">
            <label>E-mail</label>
            <input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@email.com" />
          </div>
          <div className="field">
            <label>Senha (mínimo 6 caracteres)</label>
            <input type="password" minLength={6} autoComplete={authMode === "login" ? "current-password" : "new-password"} required value={password} onChange={e => setPassword(e.target.value)} placeholder="Sua senha" />
          </div>
          <button className="btn" disabled={busy}>{busy ? "Aguarde..." : authMode === "login" ? "Entrar" : "Criar conta"}</button>
        </form>
        <button className="linkbtn" onClick={() => setAuthMode(authMode === "login" ? "signup" : "login")}>
          {authMode === "login" ? "Primeiro acesso? Criar conta" : "Já tem conta? Entrar"}
        </button>
        {notice && <div className="warning" style={{ marginTop: 12 }}>{notice}</div>}
        {!supabase && <div className="warning" style={{ marginTop: 12 }}>Configure o Supabase seguindo o LEIA-ME.md.</div>}
      </section>
    </main>;
  }

  if (!walletId) {
    return <main className="shell">
      <header className="top">
        <div className="brand"><div className="brandmark">✦</div><div><h1>DR DIAS</h1><p>FINANCEIRO IA</p></div></div>
        <button className="linkbtn" onClick={() => supabase?.auth.signOut()}>Sair</button>
      </header>
      <section className="panel">
        <h2 style={{ fontFamily: "Manrope" }}>Sua carteira familiar</h2>
        <p className="muted">Crie a carteira no primeiro usuário. Depois, o segundo usuário entra com o código de convite.</p>
        <button className="btn" onClick={createWallet} disabled={busy}>Criar carteira familiar</button>
        <div style={{ height: 18 }} />
        <div className="field">
          <label>Código de convite</label>
          <input value={inviteCode} onChange={e => setInviteCode(e.target.value)} placeholder="Ex.: A1B2C3D4" />
        </div>
        <button className="btn secondary" onClick={joinWallet} disabled={busy || !inviteCode.trim()}>Entrar em uma carteira existente</button>
        {notice && <div className="warning" style={{ marginTop: 12 }}>{notice}</div>}
      </section>
    </main>;
  }

  return <main className="shell">
    <header className="top">
      <div className="brand"><div className="brandmark">✦</div><div><h1>DR DIAS</h1><p>FINANCEIRO IA · FAMÍLIA</p></div></div>
      <div className="actions">
        <span className="tag">CARTEIRA COMPARTILHADA</span>
        <button className="linkbtn" onClick={() => supabase?.auth.signOut()}>Sair</button>
      </div>
    </header>

    {notice && <div className="notice" style={{ marginBottom: 14 }}>{notice}</div>}

    <section className="grid">
      <div className="panel balance">
        <div className="eyebrow">Saldo líquido dos lançamentos</div>
        <div className="amount">{money(totals.income - totals.expense)}</div>
        <div className="sub">Contas futuras não são descontadas</div>
      </div>
      <div className="panel">
        <div className="eyebrow">Receitas</div>
        <div className="amount green">{money(totals.income)}</div>
        <div className="sub">Receitas registradas</div>
      </div>
      <div className="panel">
        <div className="eyebrow">Despesas</div>
        <div className="amount red">{money(totals.expense)}</div>
        <div className="sub">Despesas registradas</div>
      </div>
    </section>

    <section className="section content">
      <div className="panel">
        <div className="sectionhead"><h2>Novo lançamento</h2><span className="gold">＋</span></div>
        <div className="tabs">
          <button className={`tab ${kind === "expense" ? "active" : ""}`} onClick={() => setKind("expense")}>Despesa</button>
          <button className={`tab ${kind === "income" ? "active" : ""}`} onClick={() => setKind("income")}>Receita</button>
        </div>
        <form onSubmit={addTransaction}>
          <div className="field">
            <label>Descrição</label>
            <input required value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex.: Mercado, salário, aluguel" />
          </div>
          <div className="row">
            <div className="field">
              <label>Valor (R$)</label>
              <input required inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0,00" />
            </div>
            <div className="field">
              <label>Categoria</label>
              <select value={category} onChange={e => setCategory(e.target.value)}>
                {["Alimentação", "Moradia", "Transporte", "Saúde", "Lazer", "Salário", "Contas", "Educação", "Outros"].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <button className="btn" disabled={busy}>Salvar lançamento</button>
        </form>
      </div>

      <div className="panel">
        <div className="sectionhead"><h2>Assistente financeiro</h2><span className="gold">✧ IA</span></div>
        <div className="chatbubble">{chat}</div>
        <div className="field">
          <label>Pergunte sobre suas finanças</label>
          <input value={message} onChange={e => setMessage(e.target.value)} onKeyDown={e => {
            if (e.key === "Enter" && message.trim()) {
              answerAssistant(message);
              setMessage("");
            }
          }} placeholder="Quanto gastamos? Onde economizar?" />
        </div>
        <button className="btn secondary" onClick={() => {
          if (message.trim()) {
            answerAssistant(message);
            setMessage("");
          }
        }}>Analisar meus dados</button>
        <p className="small" style={{ marginTop: 10 }}>Assistente inicial gratuito baseado nos seus lançamentos.</p>
      </div>
    </section>

    <section className="section panel">
      <div className="sectionhead">
        <h2>📅 Contas futuras</h2>
        <span className="muted">{pendingBills.length} pendentes</span>
      </div>
      <p className="muted">Cadastre contas que ainda vai pagar. Elas só entram nas despesas quando forem marcadas como pagas.</p>

      <form onSubmit={addFutureBill}>
        <div className="field">
          <label>Nome da conta</label>
          <input required value={billDescription} onChange={e => setBillDescription(e.target.value)} placeholder="Ex.: Conta de luz, internet, aluguel" />
        </div>
        <div className="row">
          <div className="field">
            <label>Valor (R$)</label>
            <input required inputMode="decimal" value={billAmount} onChange={e => setBillAmount(e.target.value)} placeholder="0,00" />
          </div>
          <div className="field">
            <label>Vencimento</label>
            <input type="date" required value={billDueDate} onChange={e => setBillDueDate(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label>Categoria</label>
          <select value={billCategory} onChange={e => setBillCategory(e.target.value)}>
            {["Contas", "Moradia", "Alimentação", "Transporte", "Saúde", "Lazer", "Educação", "Outros"].map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <button className="btn" disabled={busy}>＋ Cadastrar conta futura</button>
      </form>

      <div style={{ marginTop: 24 }}>
        <h3>Contas pendentes</h3>
        {pendingBills.length === 0 ? (
          <div className="empty">Você não tem contas futuras pendentes.</div>
        ) : pendingBills.map(b => (
          <div className="tx" key={b.id}>
            <div>
              <div className="txname">{b.description}</div>
              <div className="txmeta">
                {b.category} · Vence em {new Date(`${b.due_date}T12:00:00`).toLocaleDateString("pt-BR")}
                {b.due_date < today() && <span className="red"> · VENCIDA</span>}
              </div>
              <div className="txvalue">{money(Number(b.amount))}</div>
            </div>
            <div className="actions">
              <button className="btn" disabled={busy} onClick={() => payFutureBill(b)}>Marcar como paga</button>
              <button className="linkbtn" onClick={() => deleteFutureBill(b.id)}>Excluir</button>
            </div>
          </div>
        ))}
      </div>

      {paidBills.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3>Contas pagas</h3>
          {paidBills.map(b => (
            <div className="tx" key={b.id}>
              <div>
                <div className="txname">{b.description}</div>
                <div className="txmeta">{b.category} · Paga em {b.paid_at ? new Date(b.paid_at).toLocaleDateString("pt-BR") : "data não informada"}</div>
              </div>
              <div className="actions">
                <span className="txvalue green">{money(Number(b.amount))} · Paga</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>

    <section className="section panel">
      <div className="sectionhead"><h2>📊 Histórico mensal</h2></div>
      <div className="field">
        <label>Escolha o mês</label>
        <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} />
      </div>

      <section className="grid">
        <div className="panel">
          <div className="eyebrow">Receitas do mês</div>
          <div className="amount green">{money(monthTotals.income)}</div>
        </div>
        <div className="panel">
          <div className="eyebrow">Despesas do mês</div>
          <div className="amount red">{money(monthTotals.expense)}</div>
        </div>
        <div className="panel balance">
          <div className="eyebrow">Resultado do mês</div>
          <div className="amount">{money(monthTotals.income - monthTotals.expense)}</div>
        </div>
      </section>

      <h3>Movimentações do mês</h3>
      {monthTransactions.length === 0 ? (
        <div className="empty">Não há movimentações neste mês.</div>
      ) : monthTransactions.map(t => (
        <div className="tx" key={t.id}>
          <div>
            <div className="txname">{t.description}</div>
            <div className="txmeta">{t.category} · {new Date(t.created_at).toLocaleDateString("pt-BR")}</div>
          </div>
          <span className={`txvalue ${t.kind === "income" ? "green" : "red"}`}>
            {t.kind === "income" ? "+" : "−"} {money(Number(t.amount))}
          </span>
        </div>
      ))}
      <p className="small" style={{ marginTop: 12 }}>O histórico considera a data em que cada lançamento foi registrado. Contas futuras entram no histórico somente depois de pagas.</p>
    </section>

    <section className="section panel">
      <div className="sectionhead">
        <h2>Movimentações</h2>
        <span className="muted">{transactions.length} registros</span>
      </div>
      <div className="tabs">
        <button className={`tab ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>Todas</button>
        <button className={`tab ${filter === "income" ? "active" : ""}`} onClick={() => setFilter("income")}>Receitas</button>
        <button className={`tab ${filter === "expense" ? "active" : ""}`} onClick={() => setFilter("expense")}>Despesas</button>
      </div>

      {visible.length === 0 ? (
        <div className="empty">Ainda não há movimentações.</div>
      ) : visible.map(t => (
        <div className="tx" key={t.id}>
          <div>
            <div className="txname">{t.description}</div>
            <div className="txmeta">{t.category} · {new Date(t.created_at).toLocaleDateString("pt-BR")}</div>
          </div>
          <div className="actions">
            <span className={`txvalue ${t.kind === "income" ? "green" : "red"}`}>
              {t.kind === "income" ? "+" : "−"} {money(Number(t.amount))}
            </span>
            <button className="linkbtn" onClick={() => editTransaction(t)}>Editar</button>
            <button className="linkbtn" onClick={() => deleteTransaction(t.id)}>Excluir</button>
          </div>
        </div>
      ))}
    </section>

    <section className="section panel">
      <div className="sectionhead"><h2>Compartilhar com sua esposa</h2><span className="gold">♡</span></div>
      <p className="muted">A carteira é compartilhada. Consulte o código de convite no Supabase, na tabela wallets, coluna invite_code.</p>
      <p className="small">Você e Hemily podem consultar as mesmas contas futuras e movimentações.</p>
    </section>

    <div className="footer">DR DIAS FINANCEIRO IA · Seus dados pertencem à sua família.</div>
  </main>;
}
