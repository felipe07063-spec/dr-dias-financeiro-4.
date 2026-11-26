"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Tx = { id: string; description: string; amount: number; kind: "income" | "expense"; category: string; created_at: string; created_by?: string };
type Profile = { id: string; email?: string };
const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Home() {
  const [sessionUser, setSessionUser] = useState<Profile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [walletId, setWalletId] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [category, setCategory] = useState("Alimentação");
  const [filter, setFilter] = useState("all");
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState("Olá! Sou o assistente do DR DIAS. Posso resumir seus lançamentos e ajudar a planejar seu orçamento.");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!supabase) { setAuthReady(true); return; }
    supabase.auth.getSession().then(({ data }) => {
      setSessionUser(data.session?.user ? { id: data.session.user.id, email: data.session.user.email } : null);
      setAuthReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionUser(session?.user ? { id: session.user.id, email: session.user.email } : null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!sessionUser || !supabase) return;
    loadWallet();
  }, [sessionUser]);

  async function loadWallet() {
    if (!supabase || !sessionUser) return;
    const { data: memberships, error } = await supabase.from("wallet_members").select("wallet_id").eq("user_id", sessionUser.id).limit(1);
    if (error) { setNotice(error.message); return; }
    if (!memberships?.length) { setWalletId(""); return; }
    const id = memberships[0].wallet_id as string;
    setWalletId(id);
    await loadTransactions(id);
    const channel = supabase.channel("family-transactions-" + id).on("postgres_changes",
      { event: "*", schema: "public", table: "transactions", filter: `wallet_id=eq.${id}` },
      () => loadTransactions(id)).subscribe();
    return () => { supabase?.removeChannel(channel); };
  }

  async function loadTransactions(id: string) {
    if (!supabase) return;
    const { data, error } = await supabase.from("transactions").select("*").eq("wallet_id", id).order("created_at", { ascending: false }).limit(100);
    if (error) setNotice(error.message);
    else setTransactions((data || []) as Tx[]);
  }

  async function authSubmit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setNotice("");
    if (!supabase) { setNotice("Configure o Supabase seguindo o arquivo LEIA-ME.md para ativar login e sincronização."); setBusy(false); return; }
    const result = authMode === "signup"
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });
    if (result.error) setNotice(result.error.message);
    else if (authMode === "signup") setNotice("Cadastro enviado. Se a confirmação de e-mail estiver ativa, confirme o e-mail para entrar.");
    setBusy(false);
  }

  async function createWallet() {
    if (!supabase || !sessionUser) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("create_family_wallet");
    if (error) setNotice(error.message);
    else { setWalletId(data as string); setNotice("Carteira familiar criada. Compartilhe o código de convite com sua esposa."); await loadTransactions(data as string); }
    setBusy(false);
  }

  async function joinWallet() {
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.rpc("join_family_wallet", { invite_code_input: inviteCode.trim().toUpperCase() });
    if (error) setNotice(error.message);
    else { setNotice("Você entrou na carteira familiar!"); await loadWallet(); }
    setBusy(false);
  }

  async function addTransaction(e: FormEvent) {
    e.preventDefault();
    if (!supabase || !walletId || !description.trim() || Number(amount.replace(",", ".")) <= 0) return;
    setBusy(true);
    const { error } = await supabase.from("transactions").insert({
      wallet_id: walletId, description: description.trim(), amount: Number(amount.replace(",", ".")),
      kind, category, created_by: sessionUser?.id
    });
    if (error) setNotice(error.message);
    else { setDescription(""); setAmount(""); await loadTransactions(walletId); }
    setBusy(false);
  }

  async function editTransaction(t: Tx) {
    if (!supabase) return;
    const newDescription = prompt("Descrição do lançamento:", t.description);
    if (newDescription === null || !newDescription.trim()) return;
    const newAmountText = prompt("Valor em reais:", String(t.amount).replace(".", ","));
    if (newAmountText === null) return;
    const newAmount = Number(newAmountText.replace(",", "."));
    if (!Number.isFinite(newAmount) || newAmount <= 0) { setNotice("Informe um valor válido."); return; }
    const { error } = await supabase.from("transactions").update({
      description: newDescription.trim(), amount: newAmount
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
    if (t.kind === "income") a.income += Number(t.amount); else a.expense += Number(t.amount);
    return a;
  }, { income: 0, expense: 0 }), [transactions]);
  const visible = transactions.filter(t => filter === "all" || t.kind === filter);

  function answerAssistant(question: string) {
    const q = question.toLowerCase();
    let response = "";
    if (q.includes("quanto") || q.includes("resumo") || q.includes("gastei") || q.includes("saldo")) {
      response = `Com base nos ${transactions.length} lançamentos carregados: receitas de ${money(totals.income)}, despesas de ${money(totals.expense)} e saldo líquido de ${money(totals.income - totals.expense)}.`;
    } else if (q.includes("econom") || q.includes("cortar") || q.includes("reduzir")) {
      const byCategory = transactions.filter(t => t.kind === "expense").reduce((acc: Record<string, number>, t) => { acc[t.category] = (acc[t.category] || 0) + Number(t.amount); return acc; }, {});
      const biggest = Object.entries(byCategory).sort((a,b) => b[1]-a[1])[0];
      response = biggest ? `A categoria com maior despesa entre os lançamentos carregados é ${biggest[0]} (${money(biggest[1])}). Vale revisar esses gastos antes de definir um corte.` : "Ainda não há despesas suficientes registradas para sugerir onde economizar.";
    } else {
      response = "Posso resumir receitas e despesas, calcular o saldo líquido ou apontar a categoria com maior gasto. Para uma análise melhor, mantenha os lançamentos atualizados.";
    }
    setChat(response);
  }

  if (!authReady) return <main className="shell"><div className="panel">Carregando DR DIAS...</div></main>;

  if (!sessionUser) return <main className="shell"><section className="panel auth">
    <div className="brand"><div className="brandmark">✦</div><div><h1>DR DIAS</h1><p>FINANCEIRO IA</p></div></div>
    <h2 style={{marginTop:28}}>{authMode === "login" ? "Acesse sua carteira" : "Criar seu acesso"}</h2>
    <p>Entre com seu e-mail e senha. Os dois usuários terão acesso à mesma carteira familiar.</p>
    <form onSubmit={authSubmit}>
      <div className="field"><label>E-mail</label><input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="voce@email.com"/></div>
      <div className="field"><label>Senha (mínimo 6 caracteres)</label><input type="password" minLength={6} autoComplete={authMode === "login" ? "current-password" : "new-password"} required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Sua senha"/></div>
      <button className="btn" disabled={busy}>{busy ? "Aguarde..." : authMode === "login" ? "Entrar" : "Criar conta"}</button>
    </form>
    <button className="linkbtn" onClick={()=>setAuthMode(authMode === "login" ? "signup" : "login")}>{authMode === "login" ? "Primeiro acesso? Criar conta" : "Já tem conta? Entrar"}</button>
    {notice && <div className="warning" style={{marginTop:12}}>{notice}</div>}
    {!supabase && <div className="warning" style={{marginTop:12}}>O site está em modo de configuração. Siga o LEIA-ME.md para conectar o banco gratuito.</div>}
  </section></main>;

  if (!walletId) return <main className="shell"><header className="top"><div className="brand"><div className="brandmark">✦</div><div><h1>DR DIAS</h1><p>FINANCEIRO IA</p></div></div><button className="linkbtn" onClick={()=>supabase?.auth.signOut()}>Sair</button></header>
    <section className="panel"><h2 style={{fontFamily:"Manrope"}}>Sua carteira familiar</h2><p className="muted">Crie a carteira no primeiro usuário. Depois, o segundo usuário entra com o código de convite.</p>
      <button className="btn" onClick={createWallet} disabled={busy}>Criar carteira familiar</button>
      <div style={{height:18}}/>
      <div className="field"><label>Código de convite</label><input value={inviteCode} onChange={e=>setInviteCode(e.target.value)} placeholder="Ex.: A1B2C3D4"/></div>
      <button className="btn secondary" onClick={joinWallet} disabled={busy || !inviteCode.trim()}>Entrar em uma carteira existente</button>
      {notice && <div className="warning" style={{marginTop:12}}>{notice}</div>}
    </section></main>;

  return <main className="shell">
    <header className="top"><div className="brand"><div className="brandmark">✦</div><div><h1>DR DIAS</h1><p>FINANCEIRO IA · FAMÍLIA</p></div></div><div className="actions"><span className="tag">CARTEIRA COMPARTILHADA</span><button className="linkbtn" onClick={()=>supabase?.auth.signOut()}>Sair</button></div></header>
    {notice && <div className="notice" style={{marginBottom:14}}>{notice}</div>}
    <section className="grid">
      <div className="panel balance"><div className="eyebrow">Saldo líquido dos lançamentos</div><div className="amount">{money(totals.income-totals.expense)}</div><div className="sub">Receitas menos despesas registradas</div></div>
      <div className="panel"><div className="eyebrow">Receitas</div><div className="amount green">{money(totals.income)}</div><div className="sub">Lançamentos carregados</div></div>
      <div className="panel"><div className="eyebrow">Despesas</div><div className="amount red">{money(totals.expense)}</div><div className="sub">Lançamentos carregados</div></div>
    </section>
    <section className="section content">
      <div className="panel"><div className="sectionhead"><h2>Novo lançamento</h2><span className="gold">＋</span></div>
        <div className="tabs"><button className={`tab ${kind==="expense"?"active":""}`} onClick={()=>setKind("expense")}>Despesa</button><button className={`tab ${kind==="income"?"active":""}`} onClick={()=>setKind("income")}>Receita</button></div>
        <form onSubmit={addTransaction}>
          <div className="field"><label>Descrição</label><input required value={description} onChange={e=>setDescription(e.target.value)} placeholder="Ex.: Mercado, salário, aluguel"/></div>
          <div className="row"><div className="field"><label>Valor (R$)</label><input required inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0,00"/></div><div className="field"><label>Categoria</label><select value={category} onChange={e=>setCategory(e.target.value)}>{["Alimentação","Moradia","Transporte","Saúde","Lazer","Salário","Contas","Educação","Outros"].map(c=><option key={c}>{c}</option>)}</select></div></div>
          <button className="btn" disabled={busy}>Salvar lançamento</button>
        </form>
      </div>
      <div className="panel"><div className="sectionhead"><h2>Assistente financeiro</h2><span className="gold">✧ IA</span></div>
        <div className="chatbubble">{chat}</div>
        <div className="field"><label>Pergunte sobre suas finanças</label><input value={message} onChange={e=>setMessage(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&message.trim()){answerAssistant(message);setMessage("");}}} placeholder="Quanto gastamos? Onde economizar?"/></div>
        <button className="btn secondary" onClick={()=>{if(message.trim()){answerAssistant(message);setMessage("");}}}>Analisar meus dados</button>
        <p className="small" style={{marginTop:10}}>Assistente inicial gratuito baseado nos seus lançamentos. Não usa API paga nem substitui orientação financeira profissional.</p>
      </div>
    </section>
    <section className="section panel"><div className="sectionhead"><h2>Movimentações</h2><span className="muted">{transactions.length} registros recentes</span></div>
      <div className="tabs"><button className={`tab ${filter==="all"?"active":""}`} onClick={()=>setFilter("all")}>Todas</button><button className={`tab ${filter==="income"?"active":""}`} onClick={()=>setFilter("income")}>Receitas</button><button className={`tab ${filter==="expense"?"active":""}`} onClick={()=>setFilter("expense")}>Despesas</button></div>
      {visible.length===0 ? <div className="empty">Ainda não há movimentações. Registre a primeira acima.</div> : visible.map(t=><div className="tx" key={t.id}><div><div className="txname">{t.description}</div><div className="txmeta">{t.category} · {new Date(t.created_at).toLocaleDateString("pt-BR")}</div></div><div className="actions"><span className={`txvalue ${t.kind==="income"?"green":"red"}`}>{t.kind==="income"?"+":"−"} {money(Number(t.amount))}</span><button className="linkbtn" onClick={()=>editTransaction(t)} aria-label="Editar lançamento">Editar</button><button className="linkbtn" onClick={()=>deleteTransaction(t.id)} aria-label="Excluir lançamento">Excluir</button></div></div>)}
    </section>
    <section className="section panel"><div className="sectionhead"><h2>Compartilhar com sua esposa</h2><span className="gold">♡</span></div><p className="muted">A carteira é compartilhada. Gere ou consulte o código de convite no painel de administração do Supabase (tabela wallets, coluna invite_code) e envie para o segundo usuário.</p><p className="small">Por segurança, ambos podem lançar e excluir movimentações. O banco registra o usuário que criou cada lançamento.</p></section>
    <div className="footer">DR DIAS FINANCEIRO IA · Seus dados pertencem à sua família.</div>
  </main>;
}
