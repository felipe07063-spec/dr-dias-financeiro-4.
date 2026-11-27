"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
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

type WalletInfo = {
  id: string;
  invite_code?: string;
  name?: string;
};

type Profile = {
  id: string;
  email?: string;
};

type ViewId =
  | "home"
  | "expenses"
  | "transactions"
  | "bills"
  | "history"
  | "assistant"
  | "family"
  | "settings";

type AppSettings = {
  walletDisplayName: string;
  expenseLimit: number;
  incomeTarget: number;
  billAlertDays: number;
  showAgentBanner: boolean;
};

const DEFAULT_SETTINGS: AppSettings = {
  walletDisplayName: "Carteira familiar",
  expenseLimit: 3000,
  incomeTarget: 5000,
  billAlertDays: 5,
  showAgentBanner: true,
};

const STORAGE_KEY = "dr_dias_settings_v1";

const money = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const parseBRLAmount = (raw: string): number => {
  const cleaned = raw.trim().replace(/\s+/g, "").replace(/\./g, "").replace(",", ".");
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : NaN;
};

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
};

const monthNow = today().slice(0, 7);

const toLocalYearMonth = (isoDate: string): string => {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return isoDate.slice(0, 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const daysUntilDate = (yyyyMmDd: string): number => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const target = new Date(`${yyyyMmDd}T00:00:00`).getTime();
  return Math.round((target - startOfToday) / (1000 * 60 * 60 * 24));
};

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
  Alimentação: "🛒",
  Moradia: "🏠",
  Transporte: "🚗",
  Combustível: "⛽",
  Saúde: "💊",
  Lazer: "🎮",
  Salário: "💰",
  Contas: "💡",
  Educação: "📚",
  Restaurantes: "🍔",
  Compras: "🛍️",
  Pets: "🐶",
  "Cartão de crédito": "💳",
  Outros: "📦",
};

const icon = (category: string) => categoryIcons[category] || "📌";

const navItems: { id: ViewId; label: string; emoji: string }[] = [
  { id: "home", label: "Visão geral", emoji: "◫" },
  { id: "expenses", label: "Despesas", emoji: "↘" },
  { id: "transactions", label: "Lançamentos", emoji: "⇄" },
  { id: "bills", label: "Contas futuras", emoji: "▤" },
  { id: "history", label: "Histórico mensal", emoji: "▦" },
  { id: "assistant", label: "Assistente IA", emoji: "✧" },
  { id: "family", label: "Família", emoji: "♡" },
  { id: "settings", label: "Configurações", emoji: "⚙" },
];

export default function Home() {
  const [sessionUser, setSessionUser] = useState<Profile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");

  const [walletId, setWalletId] = useState("");
  const [walletMeta, setWalletMeta] = useState<WalletInfo | null>(null);
  const [inviteCode, setInviteCode] = useState("");

  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [futureBills, setFutureBills] = useState<FutureBill[]>([]);
  const [activeView, setActiveView] = useState<ViewId>("home");

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [category, setCategory] = useState("Alimentação");
  const [filter, setFilter] = useState<"all" | "income" | "expense">("all");

  const [billDescription, setBillDescription] = useState("");
  const [billAmount, setBillAmount] = useState("");
  const [billCategory, setBillCategory] = useState("Contas");
  const [billDueDate, setBillDueDate] = useState(today());

  const [selectedMonth, setSelectedMonth] = useState(monthNow);
  const [message, setMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<{ role: "assistant" | "user"; text: string }[]>([
    {
      role: "assistant",
      text: "Olá! Sou o assistente executivo do DR DIAS. Posso resumir receitas, despesas, saldo líquido e apontar onde concentrar economia.",
    },
  ]);

  // Configurações salvas e inputs do formulário de configurações
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [walletNameInput, setWalletNameInput] = useState(DEFAULT_SETTINGS.walletDisplayName);
  const [expenseLimitInput, setExpenseLimitInput] = useState("3.000,00");
  const [incomeTargetInput, setIncomeTargetInput] = useState("5.000,00");
  const [billAlertDaysInput, setBillAlertDaysInput] = useState("5");
  const [showAgentBannerInput, setShowAgentBannerInput] = useState(true);

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<AppSettings>;
      const merged: AppSettings = {
        walletDisplayName:
          typeof parsed.walletDisplayName === "string" && parsed.walletDisplayName.trim()
            ? parsed.walletDisplayName.trim()
            : DEFAULT_SETTINGS.walletDisplayName,
        expenseLimit:
          typeof parsed.expenseLimit === "number" && parsed.expenseLimit > 0
            ? parsed.expenseLimit
            : DEFAULT_SETTINGS.expenseLimit,
        incomeTarget:
          typeof parsed.incomeTarget === "number" && parsed.incomeTarget > 0
            ? parsed.incomeTarget
            : DEFAULT_SETTINGS.incomeTarget,
        billAlertDays:
          typeof parsed.billAlertDays === "number" && parsed.billAlertDays >= 0
            ? parsed.billAlertDays
            : DEFAULT_SETTINGS.billAlertDays,
        showAgentBanner:
          typeof parsed.showAgentBanner === "boolean"
            ? parsed.showAgentBanner
            : DEFAULT_SETTINGS.showAgentBanner,
      };
      setSettings(merged);
      setWalletNameInput(merged.walletDisplayName);
      setExpenseLimitInput(
        merged.expenseLimit.toLocaleString("pt-BR", { minimumFractionDigits: 2 })
      );
      setIncomeTargetInput(
        merged.incomeTarget.toLocaleString("pt-BR", { minimumFractionDigits: 2 })
      );
      setBillAlertDaysInput(String(merged.billAlertDays));
      setShowAgentBannerInput(merged.showAgentBanner);
    } catch {
      // ignora erro de leitura local
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      setAuthReady(true);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSessionUser(
        data.session?.user
          ? { id: data.session.user.id, email: data.session.user.email }
          : null
      );
      setAuthReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionUser(
        session?.user
          ? { id: session.user.id, email: session.user.email }
          : null
      );
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const loadTransactions = useCallback(async (id: string) => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("wallet_id", id)
      .order("created_at", { ascending: false });

    if (error) setNotice(error.message);
    else setTransactions((data || []) as Tx[]);
  }, []);

  const loadFutureBills = useCallback(async (id: string) => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("future_bills")
      .select("*")
      .eq("wallet_id", id)
      .order("due_date", { ascending: true });

    if (error) setNotice(error.message);
    else setFutureBills((data || []) as FutureBill[]);
  }, []);

  const loadWalletDetails = useCallback(async (id: string) => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("wallets")
      .select("id, invite_code, name")
      .eq("id", id)
      .maybeSingle();

    if (!error && data) {
      setWalletMeta(data as WalletInfo);
    } else {
      setWalletMeta({ id });
    }
  }, []);

  const loadWallet = useCallback(async () => {
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
      setWalletMeta(null);
      return;
    }

    const id = memberships[0].wallet_id as string;
    setWalletId(id);
    await Promise.all([loadWalletDetails(id), loadTransactions(id), loadFutureBills(id)]);
  }, [sessionUser, loadWalletDetails, loadTransactions, loadFutureBills]);

  useEffect(() => {
    if (sessionUser && supabase) {
      void loadWallet();
    }
  }, [sessionUser, loadWallet]);

  async function authSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice("");

    if (!supabase) {
      setNotice("Configure o Supabase seguindo o arquivo LEIA-ME.md.");
      setBusy(false);
      return;
    }

    const result =
      authMode === "signup"
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });

    if (result.error) {
      setNotice(result.error.message);
    } else if (authMode === "signup") {
      setNotice("Cadastro enviado. Confirme seu e-mail se solicitado.");
    }

    setBusy(false);
  }

  async function createWallet() {
    if (!supabase || !sessionUser) return;

    setBusy(true);
    setNotice("");
    const { data, error } = await supabase.rpc("create_family_wallet");

    if (error) {
      setNotice(error.message);
    } else {
      const createdId = String(data);
      setWalletId(createdId);
      setNotice("Carteira familiar criada. Compartilhe o código de convite.");
      await Promise.all([
        loadWalletDetails(createdId),
        loadTransactions(createdId),
        loadFutureBills(createdId),
      ]);
    }

    setBusy(false);
  }

  async function joinWallet() {
    if (!supabase) return;

    setBusy(true);
    setNotice("");
    const { error } = await supabase.rpc("join_family_wallet", {
      invite_code_input: inviteCode.trim().toUpperCase(),
    });

    if (error) {
      setNotice(error.message);
    } else {
      setInviteCode("");
      setNotice("Você entrou na carteira familiar!");
      await loadWallet();
    }

    setBusy(false);
  }

  async function addTransaction(e: FormEvent) {
    e.preventDefault();
    const value = parseBRLAmount(amount);

    if (!supabase || !walletId || !description.trim() || !Number.isFinite(value) || value <= 0) {
      setNotice("Confira a descrição e informe um valor válido maior que zero.");
      return;
    }

    setBusy(true);
    setNotice("");

    const { error } = await supabase.from("transactions").insert({
      wallet_id: walletId,
      description: description.trim(),
      amount: value,
      kind,
      category,
      created_by: sessionUser?.id,
    });

    if (error) {
      setNotice(error.message);
    } else {
      setDescription("");
      setAmount("");
      await loadTransactions(walletId);
      setNotice("Lançamento salvo com sucesso!");
    }

    setBusy(false);
  }

  async function addFutureBill(e: FormEvent) {
    e.preventDefault();
    const value = parseBRLAmount(billAmount);

    if (
      !supabase ||
      !walletId ||
      !billDescription.trim() ||
      !Number.isFinite(value) ||
      value <= 0 ||
      !billDueDate
    ) {
      setNotice("Confira os dados da conta futura.");
      return;
    }

    setBusy(true);
    setNotice("");

    const { error } = await supabase.from("future_bills").insert({
      wallet_id: walletId,
      description: billDescription.trim(),
      amount: value,
      category: billCategory,
      due_date: billDueDate,
      created_by: sessionUser?.id,
    });

    if (error) {
      setNotice(error.message);
    } else {
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

    if (
      !window.confirm(
        `Confirmar pagamento de ${bill.description} no valor de ${money(Number(bill.amount))}?`
      )
    ) {
      return;
    }

    setBusy(true);
    setNotice("");

    const { error } = await supabase.rpc("pay_future_bill", {
      p_bill_id: bill.id,
    });

    if (error) {
      setNotice(error.message);
    } else {
      await Promise.all([loadTransactions(walletId), loadFutureBills(walletId)]);
      setNotice("Conta paga e despesa registrada no financeiro!");
    }

    setBusy(false);
  }

  async function deleteFutureBill(id: string) {
    if (!supabase || !walletId || !window.confirm("Excluir esta conta futura?")) return;

    setBusy(true);
    const { error } = await supabase.from("future_bills").delete().eq("id", id);

    if (error) setNotice(error.message);
    else {
      await loadFutureBills(walletId);
      setNotice("Conta futura removida.");
    }
    setBusy(false);
  }

  async function editTransaction(t: Tx) {
    if (!supabase || !walletId) return;

    const newDescription = window.prompt("Descrição do lançamento:", t.description);
    if (newDescription === null || !newDescription.trim()) return;

    const newAmountText = window.prompt(
      "Valor em reais:",
      Number(t.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })
    );
    if (newAmountText === null) return;

    const newAmount = parseBRLAmount(newAmountText);
    if (!Number.isFinite(newAmount) || newAmount <= 0) {
      setNotice("Informe um valor válido.");
      return;
    }

    const { error } = await supabase
      .from("transactions")
      .update({
        description: newDescription.trim(),
        amount: newAmount,
      })
      .eq("id", t.id);

    if (error) setNotice(error.message);
    else {
      await loadTransactions(walletId);
      setNotice("Lançamento atualizado.");
    }
  }

  async function deleteTransaction(id: string) {
    if (!supabase || !walletId || !window.confirm("Excluir este lançamento?")) return;

    const { error } = await supabase.from("transactions").delete().eq("id", id);

    if (error) setNotice(error.message);
    else {
      await loadTransactions(walletId);
      setNotice("Lançamento excluído.");
    }
  }

  function handleSaveSettings(e: FormEvent) {
    e.preventDefault();
    const nextExpenseLimit = parseBRLAmount(expenseLimitInput);
    const nextIncomeTarget = parseBRLAmount(incomeTargetInput);
    const nextAlertDays = Number(billAlertDaysInput);

    if (!Number.isFinite(nextExpenseLimit) || nextExpenseLimit <= 0) {
      setNotice("Informe um limite mensal de despesas maior que zero.");
      return;
    }
    if (!Number.isFinite(nextIncomeTarget) || nextIncomeTarget <= 0) {
      setNotice("Informe uma meta mensal de receitas maior que zero.");
      return;
    }
    if (!Number.isInteger(nextAlertDays) || nextAlertDays < 0 || nextAlertDays > 60) {
      setNotice("Os dias de alerta antecipado devem estar entre 0 e 60.");
      return;
    }

    const cleanName = walletNameInput.trim() || DEFAULT_SETTINGS.walletDisplayName;
    const nextSettings: AppSettings = {
      walletDisplayName: cleanName,
      expenseLimit: nextExpenseLimit,
      incomeTarget: nextIncomeTarget,
      billAlertDays: nextAlertDays,
      showAgentBanner: showAgentBannerInput,
    };

    setSettings(nextSettings);
    setWalletNameInput(cleanName);
    setExpenseLimitInput(
      nextExpenseLimit.toLocaleString("pt-BR", { minimumFractionDigits: 2 })
    );
    setIncomeTargetInput(
      nextIncomeTarget.toLocaleString("pt-BR", { minimumFractionDigits: 2 })
    );

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSettings));
    } catch {
      // ignora erro de armazenamento
    }

    setNotice("Configurações salvas e aplicadas em todo o sistema!");
  }

  function handleResetSettings() {
    setSettings(DEFAULT_SETTINGS);
    setWalletNameInput(DEFAULT_SETTINGS.walletDisplayName);
    setExpenseLimitInput(
      DEFAULT_SETTINGS.expenseLimit.toLocaleString("pt-BR", { minimumFractionDigits: 2 })
    );
    setIncomeTargetInput(
      DEFAULT_SETTINGS.incomeTarget.toLocaleString("pt-BR", { minimumFractionDigits: 2 })
    );
    setBillAlertDaysInput(String(DEFAULT_SETTINGS.billAlertDays));
    setShowAgentBannerInput(DEFAULT_SETTINGS.showAgentBanner);

    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignora erro de armazenamento
    }

    setNotice("Configurações restauradas para os valores padrão.");
  }

  function exportTransactionsCSV() {
    if (transactions.length === 0) {
      setNotice("Não há lançamentos para exportar.");
      return;
    }

    const header = "Data;Tipo;Categoria;Descricao;Valor";
    const rows = transactions.map((t) => {
      const dateStr = new Date(t.created_at).toLocaleDateString("pt-BR");
      const kindStr = t.kind === "income" ? "Receita" : "Despesa";
      const safeDesc = `"${t.description.replace(/"/g, '""')}"`;
      const amountStr = Number(t.amount).toFixed(2).replace(".", ",");
      return `${dateStr};${kindStr};${t.category};${safeDesc};${amountStr}`;
    });

    const csvContent = "\uFEFF" + [header, ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `dr-dias-lancamentos-${today()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice("Arquivo CSV exportado com sucesso!");
  }

  const totals = useMemo(
    () =>
      transactions.reduce(
        (acc, t) => {
          if (t.kind === "income") acc.income += Number(t.amount);
          else acc.expense += Number(t.amount);
          return acc;
        },
        { income: 0, expense: 0 }
      ),
    [transactions]
  );

  const visible = useMemo(
    () => transactions.filter((t) => filter === "all" || t.kind === filter),
    [transactions, filter]
  );

  const currentMonthTransactions = useMemo(
    () => transactions.filter((t) => toLocalYearMonth(t.created_at) === monthNow),
    [transactions]
  );

  const currentMonthTotals = useMemo(
    () =>
      currentMonthTransactions.reduce(
        (acc, t) => {
          if (t.kind === "income") acc.income += Number(t.amount);
          else acc.expense += Number(t.amount);
          return acc;
        },
        { income: 0, expense: 0 }
      ),
    [currentMonthTransactions]
  );

  const monthTransactions = useMemo(
    () => transactions.filter((t) => toLocalYearMonth(t.created_at) === selectedMonth),
    [transactions, selectedMonth]
  );

  const monthTotals = useMemo(
    () =>
      monthTransactions.reduce(
        (acc, t) => {
          if (t.kind === "income") acc.income += Number(t.amount);
          else acc.expense += Number(t.amount);
          return acc;
        },
        { income: 0, expense: 0 }
      ),
    [monthTransactions]
  );

  const monthExpenses = useMemo(
    () => monthTransactions.filter((t) => t.kind === "expense"),
    [monthTransactions]
  );

  const categoryTotals = useMemo(() => {
    const result: Record<string, number> = {};
    monthExpenses.forEach((t) => {
      result[t.category] = (result[t.category] || 0) + Number(t.amount);
    });
    return Object.entries(result).sort((a, b) => b[1] - a[1]);
  }, [monthExpenses]);

  const monthlyHistory = useMemo(() => {
    const grouped: Record<string, { income: number; expense: number; count: number }> = {};
    transactions.forEach((t) => {
      const ym = toLocalYearMonth(t.created_at);
      if (!grouped[ym]) grouped[ym] = { income: 0, expense: 0, count: 0 };
      if (t.kind === "income") grouped[ym].income += Number(t.amount);
      else grouped[ym].expense += Number(t.amount);
      grouped[ym].count += 1;
    });
    return Object.entries(grouped).sort((a, b) => b[0].localeCompare(a[0]));
  }, [transactions]);

  const pendingBills = useMemo(() => futureBills.filter((b) => !b.paid), [futureBills]);
  const paidBills = useMemo(() => futureBills.filter((b) => b.paid), [futureBills]);
  const pendingTotal = useMemo(
    () => pendingBills.reduce((sum, b) => sum + Number(b.amount), 0),
    [pendingBills]
  );

  const agentBanner = useMemo(() => {
    const overdueBills = pendingBills.filter((b) => daysUntilDate(b.due_date) < 0);
    const dueSoonBills = pendingBills.filter((b) => {
      const diff = daysUntilDate(b.due_date);
      return diff >= 0 && diff <= settings.billAlertDays;
    });

    if (currentMonthTotals.expense > settings.expenseLimit) {
      return {
        tone: "alert" as const,
        badge: "AGENTE · LIMITE ULTRAPASSADO",
        text: `Você gastou ${money(currentMonthTotals.expense)} neste mês — acima do seu teto de ${money(
          settings.expenseLimit
        )}.`,
      };
    }

    if (overdueBills.length > 0) {
      return {
        tone: "alert" as const,
        badge: "AGENTE · CONTA VENCIDA",
        text: `Atenção: há ${overdueBills.length} conta(s) vencida(s) em aberto, começando por "${overdueBills[0].description}".`,
      };
    }

    if (currentMonthTotals.expense > currentMonthTotals.income && currentMonthTotals.expense > 0) {
      return {
        tone: "alert" as const,
        badge: "AGENTE · ATENÇÃO AO FLUXO",
        text: `As despesas do mês (${money(
          currentMonthTotals.expense
        )}) já superaram as receitas (${money(currentMonthTotals.income)}).`,
      };
    }

    if (currentMonthTotals.income >= settings.incomeTarget && currentMonthTotals.income > 0) {
      return {
        tone: "positive" as const,
        badge: "AGENTE · META ATINGIDA",
        text: `Sua receita do mês (${money(
          currentMonthTotals.income
        )}) superou a meta de ${money(settings.incomeTarget)}. Excelente ritmo!`,
      };
    }

    if (dueSoonBills.length > 0) {
      return {
        tone: "info" as const,
        badge: "AGENTE · VENCIMENTO PRÓXIMO",
        text: `${dueSoonBills.length} conta(s) vence(m) nos próximos ${settings.billAlertDays} dia(s): "${
          dueSoonBills[0].description
        }" (${money(Number(dueSoonBills[0].amount))}).`,
      };
    }

    return {
      tone: "positive" as const,
      badge: "AGENTE · PAINEL SAUDÁVEL",
      text: `Mês dentro dos parâmetros: ${money(currentMonthTotals.income)} de entradas e ${money(
        currentMonthTotals.expense
      )} de saídas (teto ${money(settings.expenseLimit)}).`,
    };
  }, [currentMonthTotals, pendingBills, settings]);

  function handleAssistantSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) return;

    const q = trimmed.toLowerCase();
    let reply = "";

    if (q.includes("quanto") || q.includes("resumo") || q.includes("gastei") || q.includes("saldo")) {
      reply = `Resumo de ${transactions.length} lançamentos: receitas de ${money(
        totals.income
      )}, despesas de ${money(totals.expense)} e saldo líquido de ${money(
        totals.income - totals.expense
      )}. No mês atual, você usou ${money(currentMonthTotals.expense)} do limite de ${money(
        settings.expenseLimit
      )}.`;
    } else if (
      q.includes("econom") ||
      q.includes("cortar") ||
      q.includes("reduzir") ||
      q.includes("maior")
    ) {
      const byCategory = transactions
        .filter((t) => t.kind === "expense")
        .reduce((acc: Record<string, number>, t) => {
          acc[t.category] = (acc[t.category] || 0) + Number(t.amount);
          return acc;
        }, {});

      const biggest = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];
      reply = biggest
        ? `O maior centro de custo acumulado é "${biggest[0]}" com ${money(
            biggest[1]
          )}. Ajustar essa categoria ajuda a manter seus gastos abaixo de ${money(
            settings.expenseLimit
          )}.`
        : "Ainda não há despesas suficientes registradas para sugerir cortes.";
    } else if (q.includes("conta") || q.includes("futura") || q.includes("vencer")) {
      reply =
        pendingBills.length > 0
          ? `Você tem ${pendingBills.length} contas futuras pendentes totalizando ${money(
              pendingTotal
            )}. A próxima é "${pendingBills[0].description}" (${money(
              Number(pendingBills[0].amount)
            )}) em ${new Date(`${pendingBills[0].due_date}T12:00:00`).toLocaleDateString("pt-BR")}.`
          : "Não há contas futuras pendentes no momento.";
    } else {
      reply =
        "Posso apresentar o resumo de receitas/despesas, comparar seus gastos com o limite configurado, analisar contas futuras ou apontar a categoria com maior gasto.";
    }

    setChatHistory((prev) => [
      ...prev,
      { role: "user", text: trimmed },
      { role: "assistant", text: reply },
    ]);
    setMessage("");
  }

  const monthLabel = useMemo(() => {
    const d = new Date(`${selectedMonth}-15T12:00:00`);
    if (Number.isNaN(d.getTime())) return selectedMonth;
    return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  }, [selectedMonth]);

  function Header({ title, subtitle }: { title: string; subtitle: string }) {
    return (
      <div className="page-heading">
        <div className="heading-main">
          <div className="eyebrow">DR DIAS · EMERALD EXECUTIVE</div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>

        {activeView === "home" && settings.showAgentBanner && (
          <div className={`agent-banner agent-${agentBanner.tone}`}>
            <div className="agent-banner-top">
              <span className="agent-badge">✦ {agentBanner.badge}</span>
              <div className="agent-actions">
                <button
                  type="button"
                  className="agent-link"
                  onClick={() => setActiveView("settings")}
                >
                  Configurar
                </button>
                <span>·</span>
                <button
                  type="button"
                  className="agent-link"
                  onClick={() => setActiveView("assistant")}
                >
                  IA →
                </button>
              </div>
            </div>
            <p>{agentBanner.text}</p>
          </div>
        )}

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
    symbol,
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

  function Empty({ children }: { children: ReactNode }) {
    return <div className="empty-state">{children}</div>;
  }

  if (!authReady) {
    return (
      <main className="auth-screen">
        <div className="auth-card">Carregando DR DIAS...</div>
        <style jsx global>{styles}</style>
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
              <p>FINANCEIRO EXECUTIVO</p>
            </div>
          </div>
          <div className="auth-intro">
            <span className="eyebrow">ACESSO CORPORATIVO & FAMILIAR</span>
            <h2>{authMode === "login" ? "Bem-vindo de volta." : "Crie seu acesso."}</h2>
            <p>Controle preciso de fluxo de caixa, contas futuras e carteira compartilhada.</p>
          </div>
          <form onSubmit={authSubmit} className="form-stack">
            <div className="field">
              <label>E-mail</label>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@email.com"
              />
            </div>
            <div className="field">
              <label>Senha</label>
              <input
                type="password"
                minLength={6}
                autoComplete={authMode === "login" ? "current-password" : "new-password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Sua senha"
              />
            </div>
            <button className="primary-btn" disabled={busy}>
              {busy
                ? "Aguarde..."
                : authMode === "login"
                ? "Entrar na carteira →"
                : "Criar conta →"}
            </button>
          </form>
          <button
            type="button"
            className="text-btn"
            onClick={() => setAuthMode(authMode === "login" ? "signup" : "login")}
          >
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
            <div>
              <h1>DR DIAS</h1>
              <p>FINANCEIRO EXECUTIVO</p>
            </div>
          </div>
          <div className="auth-intro">
            <span className="eyebrow">CONFIGURAÇÃO INICIAL</span>
            <h2>Sua carteira familiar</h2>
            <p>
              Crie a carteira no primeiro acesso. Depois, o segundo membro entra usando o código de
              convite.
            </p>
          </div>
          <button type="button" className="primary-btn" onClick={createWallet} disabled={busy}>
            ＋ Criar carteira familiar
          </button>
          <div className="separator">
            <span>OU ENTRE EM UMA CARTEIRA</span>
          </div>
          <div className="field">
            <label>Código de convite</label>
            <input
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="Ex.: A1B2C3D4"
            />
          </div>
          <button
            type="button"
            className="secondary-btn full"
            onClick={joinWallet}
            disabled={busy || !inviteCode.trim()}
          >
            Entrar em uma carteira existente
          </button>
          <button
            type="button"
            className="text-btn"
            onClick={() => {
              void supabase?.auth.signOut();
            }}
          >
            Sair da conta
          </button>
          {notice && <div className="notice">{notice}</div>}
        </section>
        <style jsx global>{styles}</style>
      </main>
    );
  }

  const netBalance = totals.income - totals.expense;
  const activeWalletTitle = walletMeta?.name || settings.walletDisplayName;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand sidebar-brand">
          <div className="brandmark">V</div>
          <div>
            <h1>DR DIAS</h1>
            <p>ESMERALDA & BRANCO</p>
          </div>
        </div>

        <div className="nav-caption">MENU PRINCIPAL</div>
        <nav className="navigation">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-item ${activeView === item.id ? "selected" : ""}`}
              onClick={() => {
                setActiveView(item.id);
                setNotice("");
              }}
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
              <strong>{activeWalletTitle}</strong>
              <span>Ativa · Tempo real</span>
            </div>
            <span className="online-dot" />
          </div>
          <button
            type="button"
            className="logout-btn"
            onClick={() => {
              void supabase?.auth.signOut();
            }}
          >
            <span>↪</span> Sair da conta
          </button>
        </div>
      </aside>

      <section className="main-area">
        <header className="mobile-header">
          <div className="brand">
            <div className="brandmark">V</div>
            <div>
              <h1>DR DIAS</h1>
              <p>ESMERALDA & BRANCO</p>
            </div>
          </div>
          <button
            type="button"
            className="mobile-exit"
            onClick={() => {
              void supabase?.auth.signOut();
            }}
          >
            Sair
          </button>
        </header>

        <div className="mobile-nav-strip">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`mobile-pill ${activeView === item.id ? "active" : ""}`}
              onClick={() => setActiveView(item.id)}
            >
              <span>{item.emoji}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {notice && (
          <div className="notice global-notice">
            <span>ⓘ</span>
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice("")}>
              ×
            </button>
          </div>
        )}

        {activeView === "home" && (
          <>
            <Header
              title="Visão geral"
              subtitle="Painel executivo de performance e liquidez da carteira."
            />

            <section className="welcome-strip">
              <div>
                <span className="eyebrow">{activeWalletTitle.toUpperCase()}</span>
                <h2>Alta clareza, execução rápida.</h2>
                <p>Acompanhe entradas, saídas, compromissos futuros e saldo líquido em um só lugar.</p>
              </div>
              <div className="welcome-mark">V</div>
            </section>

            <div className="section-title-row">
              <div>
                <h2>Indicadores principais</h2>
                <p>Consolidado de todos os lançamentos registrados</p>
              </div>
              <span className="period-pill">TEMPO REAL</span>
            </div>

            <section className="stats-grid">
              <StatCard
                label="Saldo líquido"
                value={money(netBalance)}
                detail="Receitas menos despesas"
                tone={netBalance >= 0 ? "emerald-value" : "negative"}
                symbol="◈"
              />
              <StatCard
                label="Receitas"
                value={money(totals.income)}
                detail={`Meta mensal: ${money(settings.incomeTarget)}`}
                tone="positive"
                symbol="↗"
              />
              <StatCard
                label="Despesas"
                value={money(totals.expense)}
                detail={`Teto mensal: ${money(settings.expenseLimit)}`}
                tone="negative"
                symbol="↘"
              />
              <StatCard
                label="Contas pendentes"
                value={money(pendingTotal)}
                detail={`${pendingBills.length} conta(s) a pagar`}
                symbol="▤"
              />
            </section>

            <section className="dashboard-grid">
              <div className="surface">
                <div className="surface-heading">
                  <div>
                    <h3>Despesas por categoria</h3>
                    <p>Distribuição dos gastos em {monthLabel}</p>
                  </div>
                  <button
                    type="button"
                    className="small-link"
                    onClick={() => setActiveView("expenses")}
                  >
                    Ver detalhes →
                  </button>
                </div>
                {categoryTotals.length === 0 ? (
                  <Empty>Nenhuma despesa registrada neste mês.</Empty>
                ) : (
                  <div className="category-preview">
                    {categoryTotals.slice(0, 5).map(([name, value]) => {
                      const percent =
                        monthTotals.expense > 0 ? (value / monthTotals.expense) * 100 : 0;
                      return (
                        <div className="category-line" key={name}>
                          <div className="category-line-top">
                            <span className="category-name">
                              <span className="category-emoji">{icon(name)}</span>
                              {name}
                            </span>
                            <strong>{money(value)}</strong>
                          </div>
                          <div className="progress-track">
                            <div className="progress-fill" style={{ width: `${percent}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="surface">
                <div className="surface-heading">
                  <div>
                    <h3>Últimas movimentações</h3>
                    <p>Atividade recente da carteira</p>
                  </div>
                  <button
                    type="button"
                    className="small-link"
                    onClick={() => setActiveView("transactions")}
                  >
                    Ver todas →
                  </button>
                </div>
                {transactions.length === 0 ? (
                  <Empty>Nenhum lançamento por enquanto.</Empty>
                ) : (
                  <div className="compact-list">
                    {transactions.slice(0, 5).map((t) => (
                      <div className="compact-row" key={t.id}>
                        <div className="compact-icon">{icon(t.category)}</div>
                        <div className="compact-info">
                          <strong>{t.description}</strong>
                          <span>
                            {t.category} · {new Date(t.created_at).toLocaleDateString("pt-BR")}
                          </span>
                        </div>
                        <strong className={t.kind === "income" ? "positive" : "negative"}>
                          {t.kind === "income" ? "+" : "−"}
                          {money(Number(t.amount))}
                        </strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <div className="quick-actions">
              <button
                type="button"
                className="quick-action"
                onClick={() => {
                  setKind("expense");
                  setActiveView("transactions");
                }}
              >
                <span className="quick-icon red-bg">↘</span>
                <span>
                  <strong>Nova despesa</strong>
                  <small>Registrar saída</small>
                </span>
                <b>→</b>
              </button>
              <button
                type="button"
                className="quick-action"
                onClick={() => {
                  setKind("income");
                  setActiveView("transactions");
                }}
              >
                <span className="quick-icon emerald-bg">↗</span>
                <span>
                  <strong>Nova receita</strong>
                  <small>Registrar entrada</small>
                </span>
                <b>→</b>
              </button>
              <button
                type="button"
                className="quick-action"
                onClick={() => setActiveView("bills")}
              >
                <span className="quick-icon mint-bg">▤</span>
                <span>
                  <strong>Contas futuras</strong>
                  <small>Agendar vencimentos</small>
                </span>
                <b>→</b>
              </button>
            </div>
          </>
        )}

        {activeView === "expenses" && (
          <>
            <Header
              title="Despesas"
              subtitle="Análise detalhada de custos por categoria e período."
            />
            <div className="section-title-row">
              <div>
                <h2>Resumo das despesas</h2>
                <p>Gastos agrupados por categoria</p>
              </div>
              <input
                className="month-filter"
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              />
            </div>

            <div className="expense-total-card">
              <div>
                <span className="eyebrow">TOTAL DE DESPESAS · {monthLabel.toUpperCase()}</span>
                <div className="expense-total-value">{money(monthTotals.expense)}</div>
                <p>
                  {monthExpenses.length} despesa(s) · Teto configurado:{" "}
                  {money(settings.expenseLimit)}
                </p>
              </div>
              <div className="expense-total-icon">↘</div>
            </div>

            <div className="section-title-row compact-heading">
              <div>
                <h2>Onde o orçamento foi alocado</h2>
                <p>Participação percentual de cada categoria</p>
              </div>
            </div>

            {categoryTotals.length === 0 ? (
              <div className="surface">
                <Empty>Não existem despesas neste mês.</Empty>
              </div>
            ) : (
              <div className="expense-category-grid">
                {categoryTotals.map(([name, value]) => {
                  const percent =
                    monthTotals.expense > 0 ? (value / monthTotals.expense) * 100 : 0;
                  return (
                    <div className="expense-category-card" key={name}>
                      <div className="expense-category-top">
                        <span className="category-emoji large-emoji">{icon(name)}</span>
                        <span className="category-percent">{percent.toFixed(0)}%</span>
                      </div>
                      <strong>{name}</strong>
                      <div className="expense-category-value">{money(value)}</div>
                      <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${percent}%` }} />
                      </div>
                      <span className="category-hint">do total de despesas</span>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="surface section-gap">
              <div className="surface-heading">
                <div>
                  <h3>Detalhamento dos gastos</h3>
                  <p>Lançamentos de saída em {monthLabel}</p>
                </div>
              </div>
              {monthExpenses.length === 0 ? (
                <Empty>Nenhuma despesa para mostrar.</Empty>
              ) : (
                <div className="transaction-list">
                  {monthExpenses.map((t) => (
                    <div className="transaction-row" key={t.id}>
                      <div className="transaction-left">
                        <div className="transaction-icon">{icon(t.category)}</div>
                        <div>
                          <strong>{t.description}</strong>
                          <span>
                            {t.category} · {new Date(t.created_at).toLocaleDateString("pt-BR")}
                          </span>
                        </div>
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
            <Header
              title="Lançamentos"
              subtitle="Registre, edite e filtre todas as movimentações da carteira."
            />
            <div className="dashboard-grid">
              <div className="surface">
                <div className="surface-heading">
                  <div>
                    <h3>Novo lançamento</h3>
                    <p>Adicione uma receita ou despesa</p>
                  </div>
                </div>
                <div className="toggle-tabs">
                  <button
                    type="button"
                    className={kind === "expense" ? "active expense-tab" : ""}
                    onClick={() => setKind("expense")}
                  >
                    ↘ Despesa
                  </button>
                  <button
                    type="button"
                    className={kind === "income" ? "active income-tab" : ""}
                    onClick={() => setKind("income")}
                  >
                    ↗ Receita
                  </button>
                </div>
                <form onSubmit={addTransaction} className="form-stack">
                  <div className="field">
                    <label>Descrição</label>
                    <input
                      required
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Ex.: Mercado, salário, consultoria"
                    />
                  </div>
                  <div className="field">
                    <label>Valor (R$)</label>
                    <input
                      required
                      inputMode="decimal"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0,00"
                    />
                  </div>
                  <div className="field">
                    <label>Categoria</label>
                    <select value={category} onChange={(e) => setCategory(e.target.value)}>
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {icon(c)} {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button className="primary-btn" disabled={busy}>
                    {busy ? "Salvando..." : "＋ Salvar lançamento"}
                  </button>
                </form>
              </div>

              <div className="surface">
                <div className="surface-heading">
                  <div>
                    <h3>Resumo da carteira</h3>
                    <p>Totais acumulados</p>
                  </div>
                </div>
                <div className="mini-stat">
                  <span>Receitas</span>
                  <strong className="positive">{money(totals.income)}</strong>
                </div>
                <div className="mini-stat">
                  <span>Despesas</span>
                  <strong className="negative">{money(totals.expense)}</strong>
                </div>
                <div className="mini-stat total-mini">
                  <span>Saldo líquido</span>
                  <strong className={netBalance >= 0 ? "emerald-value" : "negative"}>
                    {money(netBalance)}
                  </strong>
                </div>
              </div>
            </div>

            <div className="surface section-gap">
              <div className="surface-heading">
                <div>
                  <h3>Movimentações</h3>
                  <p>{transactions.length} registro(s) na carteira</p>
                </div>
              </div>
              <div className="toggle-tabs filter-tabs">
                <button
                  type="button"
                  className={filter === "all" ? "active" : ""}
                  onClick={() => setFilter("all")}
                >
                  Todas
                </button>
                <button
                  type="button"
                  className={filter === "income" ? "active income-tab" : ""}
                  onClick={() => setFilter("income")}
                >
                  Receitas
                </button>
                <button
                  type="button"
                  className={filter === "expense" ? "active expense-tab" : ""}
                  onClick={() => setFilter("expense")}
                >
                  Despesas
                </button>
              </div>
              {visible.length === 0 ? (
                <Empty>Ainda não há movimentações para este filtro.</Empty>
              ) : (
                <div className="transaction-list">
                  {visible.map((t) => (
                    <div className="transaction-row" key={t.id}>
                      <div className="transaction-left">
                        <div className="transaction-icon">{icon(t.category)}</div>
                        <div>
                          <strong>{t.description}</strong>
                          <span>
                            {t.category} · {new Date(t.created_at).toLocaleDateString("pt-BR")}
                          </span>
                        </div>
                      </div>
                      <div className="transaction-actions">
                        <strong className={t.kind === "income" ? "positive" : "negative"}>
                          {t.kind === "income" ? "+" : "−"} {money(Number(t.amount))}
                        </strong>
                        <button
                          type="button"
                          className="icon-action"
                          title="Editar"
                          onClick={() => {
                            void editTransaction(t);
                          }}
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          className="icon-action danger-action"
                          title="Excluir"
                          onClick={() => {
                            void deleteTransaction(t.id);
                          }}
                        >
                          ×
                        </button>
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
            <Header
              title="Contas futuras"
              subtitle="Planeje vencimentos sem impactar o saldo antes da confirmação do pagamento."
            />
            <div className="dashboard-grid">
              <div className="surface">
                <div className="surface-heading">
                  <div>
                    <h3>Agendar conta futura</h3>
                    <p>Adicione compromissos a vencer</p>
                  </div>
                </div>
                <form onSubmit={addFutureBill} className="form-stack">
                  <div className="field">
                    <label>Descrição</label>
                    <input
                      required
                      value={billDescription}
                      onChange={(e) => setBillDescription(e.target.value)}
                      placeholder="Ex.: Energia elétrica, internet, condomínio"
                    />
                  </div>
                  <div className="field">
                    <label>Valor (R$)</label>
                    <input
                      required
                      inputMode="decimal"
                      value={billAmount}
                      onChange={(e) => setBillAmount(e.target.value)}
                      placeholder="0,00"
                    />
                  </div>
                  <div className="field">
                    <label>Categoria</label>
                    <select
                      value={billCategory}
                      onChange={(e) => setBillCategory(e.target.value)}
                    >
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {icon(c)} {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Data de vencimento</label>
                    <input
                      type="date"
                      required
                      value={billDueDate}
                      onChange={(e) => setBillDueDate(e.target.value)}
                    />
                  </div>
                  <button className="primary-btn" disabled={busy}>
                    {busy ? "Salvando..." : "＋ Adicionar conta futura"}
                  </button>
                </form>
              </div>

              <div className="surface">
                <div className="surface-heading">
                  <div>
                    <h3>Compromissos em aberto</h3>
                    <p>Total previsto para pagamento</p>
                  </div>
                </div>
                <div className="mini-stat">
                  <span>Contas pendentes</span>
                  <strong>{pendingBills.length}</strong>
                </div>
                <div className="mini-stat">
                  <span>Contas pagas</span>
                  <strong className="positive">{paidBills.length}</strong>
                </div>
                <div className="mini-stat total-mini">
                  <span>Total a pagar</span>
                  <strong className="negative">{money(pendingTotal)}</strong>
                </div>
              </div>
            </div>

            <div className="surface section-gap">
              <div className="surface-heading">
                <div>
                  <h3>Contas pendentes</h3>
                  <p>Confirme o pagamento para lançar automaticamente nas despesas</p>
                </div>
              </div>
              {pendingBills.length === 0 ? (
                <Empty>Nenhuma conta pendente no momento.</Empty>
              ) : (
                <div className="transaction-list">
                  {pendingBills.map((bill) => (
                    <div className="transaction-row" key={bill.id}>
                      <div className="transaction-left">
                        <div className="transaction-icon">{icon(bill.category)}</div>
                        <div>
                          <strong>{bill.description}</strong>
                          <span>
                            {bill.category} · Vence em{" "}
                            {new Date(`${bill.due_date}T12:00:00`).toLocaleDateString("pt-BR")}
                          </span>
                        </div>
                      </div>
                      <div className="transaction-actions">
                        <strong className="negative">{money(Number(bill.amount))}</strong>
                        <button
                          type="button"
                          className="pay-btn"
                          disabled={busy}
                          onClick={() => {
                            void payFutureBill(bill);
                          }}
                        >
                          ✓ Pagar
                        </button>
                        <button
                          type="button"
                          className="icon-action danger-action"
                          title="Excluir"
                          onClick={() => {
                            void deleteFutureBill(bill.id);
                          }}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {paidBills.length > 0 && (
              <div className="surface section-gap">
                <div className="surface-heading">
                  <div>
                    <h3>Contas já pagas</h3>
                    <p>Histórico de pagamentos liquidados</p>
                  </div>
                </div>
                <div className="transaction-list">
                  {paidBills.map((bill) => (
                    <div className="transaction-row" key={bill.id}>
                      <div className="transaction-left">
                        <div className="transaction-icon">{icon(bill.category)}</div>
                        <div>
                          <strong>{bill.description}</strong>
                          <span>
                            {bill.category} · Pago em{" "}
                            {bill.paid_at
                              ? new Date(bill.paid_at).toLocaleDateString("pt-BR")
                              : "confirmado"}
                          </span>
                        </div>
                      </div>
                      <strong className="positive">{money(Number(bill.amount))}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {activeView === "history" && (
          <>
            <Header
              title="Histórico mensal"
              subtitle="Evolução comparativa de entradas, saídas e resultado por mês."
            />
            <div className="surface">
              <div className="surface-heading">
                <div>
                  <h3>Consolidado por mês</h3>
                  <p>Comparativo de fluxo de caixa mensal</p>
                </div>
              </div>
              {monthlyHistory.length === 0 ? (
                <Empty>Ainda não há histórico mensal disponível.</Empty>
              ) : (
                <div className="history-grid">
                  {monthlyHistory.map(([ym, data]) => {
                    const balance = data.income - data.expense;
                    const label = new Date(`${ym}-15T12:00:00`).toLocaleDateString("pt-BR", {
                      month: "long",
                      year: "numeric",
                    });
                    return (
                      <div className="history-card" key={ym}>
                        <div className="history-top">
                          <strong>{label}</strong>
                          <span className="period-pill">{data.count} lanç.</span>
                        </div>
                        <div className="mini-stat">
                          <span>Receitas</span>
                          <strong className="positive">{money(data.income)}</strong>
                        </div>
                        <div className="mini-stat">
                          <span>Despesas</span>
                          <strong className="negative">{money(data.expense)}</strong>
                        </div>
                        <div className="mini-stat total-mini">
                          <span>Resultado</span>
                          <strong className={balance >= 0 ? "emerald-value" : "negative"}>
                            {money(balance)}
                          </strong>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {activeView === "assistant" && (
          <>
            <Header
              title="Assistente IA"
              subtitle="Consultas rápidas sobre saldo, categorias de gasto e compromissos."
            />
            <div className="surface">
              <div className="surface-heading">
                <div>
                  <h3>Consultor financeiro DR DIAS</h3>
                  <p>Pergunte sobre resumo, saldo, contas futuras ou onde economizar</p>
                </div>
              </div>

              <div className="chat-thread">
                {chatHistory.map((item, index) => (
                  <div
                    key={`${item.role}-${index}`}
                    className={`chat-bubble ${item.role === "user" ? "user-bubble" : "ai-bubble"}`}
                  >
                    <span className="chat-role">
                      {item.role === "user" ? "Você" : "Assistente DR DIAS"}
                    </span>
                    <p>{item.text}</p>
                  </div>
                ))}
              </div>

              <form onSubmit={handleAssistantSubmit} className="chat-form">
                <input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Ex.: Qual meu saldo e onde posso economizar?"
                />
                <button type="submit" className="primary-btn compact-btn">
                  Enviar →
                </button>
              </form>
            </div>
          </>
        )}

        {activeView === "family" && (
          <>
            <Header
              title="Família"
              subtitle="Gerencie o acesso compartilhado e o código de convite da carteira."
            />
            <div className="dashboard-grid">
              <div className="surface">
                <div className="surface-heading">
                  <div>
                    <h3>Dados da carteira</h3>
                    <p>Identificação e convite para membros</p>
                  </div>
                </div>
                <div className="mini-stat">
                  <span>Responsável logado</span>
                  <strong>{sessionUser?.email || "Usuário autenticado"}</strong>
                </div>
                <div className="mini-stat">
                  <span>ID da carteira</span>
                  <strong className="code-text">{walletId}</strong>
                </div>
                <div className="mini-stat total-mini">
                  <span>Código de convite</span>
                  <strong className="emerald-value">
                    {walletMeta?.invite_code || "Disponível na carteira"}
                  </strong>
                </div>
              </div>

              <div className="surface">
                <div className="surface-heading">
                  <div>
                    <h3>Como convidar outro membro</h3>
                    <p>Compartilhamento seguro via Supabase</p>
                  </div>
                </div>
                <p className="family-copy">
                  Envie o código de convite da carteira para o outro membro. Ao criar conta ou entrar
                  no app, basta acessar a tela de carteira e informar o código para sincronizar
                  lançamentos e contas futuras em tempo real.
                </p>
              </div>
            </div>
          </>
        )}

        {activeView === "settings" && (
          <>
            <Header
              title="Configurações"
              subtitle="Personalize os alertas do agente, metas mensais e preferências do painel."
            />

            <div className="dashboard-grid">
              <div className="surface">
                <div className="surface-heading">
                  <div>
                    <h3>Regras do agente e metas</h3>
                    <p>Defina os parâmetros que alimentam os alertas da visão geral</p>
                  </div>
                </div>

                <form onSubmit={handleSaveSettings} className="form-stack">
                  <div className="field">
                    <label>Nome exibido da carteira</label>
                    <input
                      required
                      value={walletNameInput}
                      onChange={(e) => setWalletNameInput(e.target.value)}
                      placeholder="Ex.: Família Dias"
                    />
                  </div>

                  <div className="field">
                    <label>Limite mensal de despesas (R$)</label>
                    <input
                      required
                      inputMode="decimal"
                      value={expenseLimitInput}
                      onChange={(e) => setExpenseLimitInput(e.target.value)}
                      placeholder="3.000,00"
                    />
                  </div>

                  <div className="field">
                    <label>Meta mensal de receitas (R$)</label>
                    <input
                      required
                      inputMode="decimal"
                      value={incomeTargetInput}
                      onChange={(e) => setIncomeTargetInput(e.target.value)}
                      placeholder="5.000,00"
                    />
                  </div>

                  <div className="field">
                    <label>Avisar contas futuras com antecedência de (dias)</label>
                    <input
                      type="number"
                      min={0}
                      max={60}
                      required
                      value={billAlertDaysInput}
                      onChange={(e) => setBillAlertDaysInput(e.target.value)}
                    />
                  </div>

                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={showAgentBannerInput}
                      onChange={(e) => setShowAgentBannerInput(e.target.checked)}
                    />
                    <span>Exibir banner inteligente do agente no topo da Visão Geral</span>
                  </label>

                  <div className="settings-btn-row">
                    <button type="submit" className="primary-btn">
                      ✓ Salvar configurações
                    </button>
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={handleResetSettings}
                    >
                      Restaurar padrão
                    </button>
                  </div>
                </form>
              </div>

              <div className="surface">
                <div className="surface-heading">
                  <div>
                    <h3>Resumo ativo e exportação</h3>
                    <p>Parâmetros em vigor e ferramentas de backup</p>
                  </div>
                </div>

                <div className="mini-stat">
                  <span>Carteira exibida</span>
                  <strong>{activeWalletTitle}</strong>
                </div>
                <div className="mini-stat">
                  <span>Teto de gastos do mês</span>
                  <strong className="negative">{money(settings.expenseLimit)}</strong>
                </div>
                <div className="mini-stat">
                  <span>Meta de receita do mês</span>
                  <strong className="positive">{money(settings.incomeTarget)}</strong>
                </div>
                <div className="mini-stat">
                  <span>Antecedência de vencimento</span>
                  <strong>{settings.billAlertDays} dia(s)</strong>
                </div>
                <div className="mini-stat total-mini">
                  <span>Gasto atual no mês</span>
                  <strong
                    className={
                      currentMonthTotals.expense > settings.expenseLimit
                        ? "negative"
                        : "emerald-value"
                    }
                  >
                    {money(currentMonthTotals.expense)}
                  </strong>
                </div>

                <div className="settings-tools">
                  <button
                    type="button"
                    className="secondary-btn full"
                    onClick={exportTransactionsCSV}
                  >
                    ↓ Exportar lançamentos (CSV / Excel)
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </section>

      <style jsx global>{styles}</style>
    </main>
  );
}

const styles = `
  :root {
    --bg-canvas: #f8fafc;
    --bg-surface: #ffffff;
    --bg-soft: #f1f5f9;
    --bg-emerald-soft: #ecfdf5;
    --bg-mint-soft: #f0fdfa;
    --ink-primary: #0f172a;
    --ink-secondary: #334155;
    --ink-muted: #64748b;
    --emerald-primary: #10b981;
    --emerald-vivid: #34d399;
    --emerald-dark: #059669;
    --emerald-deep: #065f46;
    --forest-dark: #15803d;
    --mint-accent: #14b8a6;
    --emerald-glow: rgba(16, 185, 129, 0.24);
    --border-emerald: #a7f3d0;
    --border-card: #e2e8f0;
    --danger: #dc2626;
    --danger-bg: #fef2f2;
  }

  * {
    box-sizing: border-box;
  }

  html,
  body {
    margin: 0;
    padding: 0;
    background: var(--bg-canvas);
    color: var(--ink-primary);
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }

  button,
  input,
  select {
    font-family: inherit;
  }

  .auth-screen {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background:
      radial-gradient(circle at top right, rgba(16, 185, 129, 0.16), transparent 45%),
      radial-gradient(circle at bottom left, rgba(20, 184, 166, 0.12), transparent 50%),
      var(--bg-canvas);
  }

  .auth-card {
    width: 100%;
    max-width: 430px;
    background: var(--bg-surface);
    border: 1px solid var(--border-card);
    border-radius: 24px;
    padding: 32px;
    box-shadow: 0 20px 45px rgba(15, 23, 42, 0.06);
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .brandmark {
    width: 42px;
    height: 42px;
    border-radius: 14px;
    display: grid;
    place-items: center;
    font-weight: 900;
    font-size: 19px;
    color: #ffffff;
    background: linear-gradient(135deg, var(--emerald-primary), var(--forest-dark));
    box-shadow: 0 8px 20px var(--emerald-glow);
  }

  .brand h1 {
    margin: 0;
    font-size: 17px;
    letter-spacing: 0.08em;
    font-weight: 800;
    color: var(--ink-primary);
  }

  .brand p {
    margin: 2px 0 0;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.12em;
    color: var(--emerald-dark);
  }

  .auth-intro {
    margin: 24px 0 20px;
  }

  .eyebrow {
    display: inline-block;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--emerald-dark);
  }

  .auth-intro h2 {
    margin: 8px 0 6px;
    font-size: 24px;
    color: var(--ink-primary);
  }

  .auth-intro p {
    margin: 0;
    color: var(--ink-muted);
    font-size: 14px;
    line-height: 1.5;
  }

  .form-stack {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .field label {
    font-size: 12px;
    font-weight: 700;
    color: var(--ink-secondary);
  }

  .field input,
  .field select,
  .month-filter,
  .chat-form input {
    width: 100%;
    padding: 12px 14px;
    border-radius: 12px;
    border: 1px solid var(--border-card);
    background: #ffffff;
    color: var(--ink-primary);
    font-size: 14px;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }

  .field input:focus,
  .field select:focus,
  .month-filter:focus,
  .chat-form input:focus {
    outline: none;
    border-color: var(--emerald-primary);
    box-shadow: 0 0 0 3px var(--emerald-glow);
  }

  .checkbox-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 12px;
    background: var(--bg-canvas);
    border: 1px solid var(--border-card);
    font-size: 13px;
    font-weight: 600;
    color: var(--ink-secondary);
    cursor: pointer;
  }

  .checkbox-row input {
    width: 16px;
    height: 16px;
    accent-color: var(--emerald-primary);
  }

  .settings-btn-row {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .settings-tools {
    margin-top: 18px;
  }

  .primary-btn {
    border: none;
    border-radius: 12px;
    padding: 13px 18px;
    font-size: 14px;
    font-weight: 800;
    color: #ffffff;
    background: linear-gradient(135deg, var(--emerald-primary), var(--emerald-dark));
    box-shadow: 0 8px 20px var(--emerald-glow);
    cursor: pointer;
    transition: transform 0.12s ease, filter 0.15s ease;
  }

  .primary-btn:hover:not(:disabled) {
    filter: brightness(1.04);
    transform: translateY(-1px);
  }

  .primary-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .secondary-btn {
    border: 1px solid var(--emerald-primary);
    border-radius: 12px;
    padding: 12px 16px;
    font-size: 14px;
    font-weight: 700;
    color: var(--emerald-deep);
    background: var(--bg-emerald-soft);
    cursor: pointer;
  }

  .secondary-btn.full {
    width: 100%;
  }

  .text-btn {
    margin-top: 14px;
    width: 100%;
    background: none;
    border: none;
    color: var(--emerald-dark);
    font-weight: 700;
    font-size: 13px;
    cursor: pointer;
  }

  .separator {
    margin: 20px 0 16px;
    text-align: center;
    position: relative;
  }

  .separator::before {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    top: 50%;
    height: 1px;
    background: var(--border-card);
  }

  .separator span {
    position: relative;
    background: var(--bg-surface);
    padding: 0 10px;
    font-size: 11px;
    font-weight: 700;
    color: var(--ink-muted);
    letter-spacing: 0.08em;
  }

  .app-shell {
    min-height: 100vh;
    display: flex;
    background: var(--bg-canvas);
  }

  .sidebar {
    width: 268px;
    flex-shrink: 0;
    background: var(--bg-surface);
    border-right: 1px solid var(--border-card);
    padding: 24px 18px;
    display: flex;
    flex-direction: column;
    position: sticky;
    top: 0;
    height: 100vh;
  }

  .sidebar-brand {
    padding: 4px 8px 22px;
    border-bottom: 1px solid var(--border-card);
  }

  .nav-caption {
    margin: 20px 10px 10px;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.12em;
    color: var(--ink-muted);
  }

  .navigation {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .nav-item {
    position: relative;
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 11px 14px;
    border-radius: 12px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--ink-secondary);
    font-size: 14px;
    font-weight: 600;
    text-align: left;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .nav-item:hover {
    background: var(--bg-soft);
    color: var(--ink-primary);
  }

  .nav-item.selected {
    background: var(--bg-emerald-soft);
    border-color: var(--border-emerald);
    color: var(--emerald-deep);
    font-weight: 800;
  }

  .nav-icon {
    font-size: 15px;
    width: 18px;
    text-align: center;
  }

  .nav-indicator {
    margin-left: auto;
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background: var(--emerald-primary);
  }

  .sidebar-bottom {
    margin-top: auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-top: 16px;
    border-top: 1px solid var(--border-card);
  }

  .wallet-mini {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 14px;
    background: var(--bg-emerald-soft);
    border: 1px solid var(--border-emerald);
  }

  .wallet-mini-icon {
    width: 32px;
    height: 32px;
    border-radius: 10px;
    display: grid;
    place-items: center;
    background: var(--emerald-primary);
    color: #ffffff;
    font-weight: 800;
  }

  .wallet-mini strong {
    display: block;
    font-size: 12px;
    color: var(--ink-primary);
  }

  .wallet-mini span {
    display: block;
    font-size: 11px;
    color: var(--emerald-dark);
  }

  .online-dot {
    margin-left: auto;
    width: 9px;
    height: 9px;
    border-radius: 999px;
    background: var(--emerald-primary);
    box-shadow: 0 0 0 3px var(--emerald-glow);
  }

  .logout-btn {
    width: 100%;
    padding: 10px 12px;
    border-radius: 12px;
    border: 1px solid var(--border-card);
    background: #ffffff;
    color: var(--ink-secondary);
    font-weight: 700;
    font-size: 13px;
    cursor: pointer;
  }

  .logout-btn:hover {
    border-color: var(--danger);
    color: var(--danger);
  }

  .main-area {
    flex: 1;
    min-width: 0;
    padding: 32px 36px 56px;
    max-width: 1260px;
    margin: 0 auto;
  }

  .mobile-header,
  .mobile-nav-strip {
    display: none;
  }

  .page-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 24px;
  }

  .heading-main {
    flex-shrink: 0;
  }

  .page-heading h1 {
    margin: 4px 0;
    font-size: 30px;
    font-weight: 900;
    letter-spacing: -0.02em;
    color: var(--ink-primary);
  }

  .page-heading p {
    margin: 0;
    color: var(--ink-muted);
    font-size: 14px;
  }

  .agent-banner {
    flex: 1;
    min-width: 240px;
    max-width: 520px;
    padding: 12px 16px;
    border-radius: 16px;
    border: 1px solid var(--border-emerald);
    background: linear-gradient(135deg, #ffffff 0%, var(--bg-emerald-soft) 100%);
    box-shadow: 0 6px 18px rgba(16, 185, 129, 0.08);
  }

  .agent-banner.agent-alert {
    border-color: #fca5a5;
    background: linear-gradient(135deg, #ffffff 0%, #fef2f2 100%);
    box-shadow: 0 6px 18px rgba(220, 38, 38, 0.08);
  }

  .agent-banner.agent-info {
    border-color: #99f6e4;
    background: linear-gradient(135deg, #ffffff 0%, var(--bg-mint-soft) 100%);
  }

  .agent-banner-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 4px;
  }

  .agent-badge {
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 0.08em;
    color: var(--emerald-deep);
  }

  .agent-banner.agent-alert .agent-badge {
    color: var(--danger);
  }

  .agent-actions {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--ink-muted);
  }

  .agent-link {
    background: none;
    border: none;
    padding: 0;
    font-size: 11px;
    font-weight: 800;
    color: var(--emerald-dark);
    cursor: pointer;
  }

  .agent-banner.agent-alert .agent-link {
    color: var(--danger);
  }

  .agent-banner p {
    margin: 0;
    font-size: 12.5px;
    line-height: 1.4;
    font-weight: 600;
    color: var(--ink-primary);
  }

  .user-chip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 9px 14px;
    border-radius: 999px;
    background: var(--bg-surface);
    border: 1px solid var(--border-card);
    font-size: 13px;
    font-weight: 700;
    color: var(--ink-primary);
    flex-shrink: 0;
  }

  .user-avatar {
    width: 22px;
    height: 22px;
    border-radius: 999px;
    display: grid;
    place-items: center;
    background: var(--emerald-primary);
    color: #ffffff;
    font-size: 11px;
    font-weight: 900;
  }

  .welcome-strip {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    padding: 24px 28px;
    border-radius: 22px;
    background: linear-gradient(125deg, #ffffff 0%, var(--bg-emerald-soft) 70%, var(--bg-mint-soft) 100%);
    border: 1px solid var(--border-emerald);
    margin-bottom: 28px;
  }

  .welcome-strip h2 {
    margin: 6px 0;
    font-size: 23px;
    font-weight: 800;
    color: var(--ink-primary);
  }

  .welcome-strip p {
    margin: 0;
    color: var(--ink-secondary);
    font-size: 14px;
  }

  .welcome-mark {
    width: 58px;
    height: 58px;
    border-radius: 18px;
    display: grid;
    place-items: center;
    font-size: 26px;
    font-weight: 900;
    color: #ffffff;
    background: linear-gradient(135deg, var(--emerald-primary), var(--forest-dark));
    flex-shrink: 0;
  }

  .section-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;
  }

  .section-title-row.compact-heading {
    margin-top: 24px;
  }

  .section-title-row h2 {
    margin: 0;
    font-size: 19px;
    font-weight: 800;
  }

  .section-title-row p {
    margin: 2px 0 0;
    font-size: 13px;
    color: var(--ink-muted);
  }

  .period-pill {
    padding: 6px 12px;
    border-radius: 999px;
    background: var(--bg-emerald-soft);
    border: 1px solid var(--border-emerald);
    color: var(--emerald-deep);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.08em;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 16px;
    margin-bottom: 24px;
  }

  .stat-card {
    background: var(--bg-surface);
    border: 1px solid var(--border-card);
    border-radius: 20px;
    padding: 20px;
    box-shadow: 0 6px 20px rgba(15, 23, 42, 0.03);
  }

  .stat-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 13px;
    font-weight: 700;
    color: var(--ink-muted);
  }

  .stat-symbol {
    width: 28px;
    height: 28px;
    border-radius: 9px;
    display: grid;
    place-items: center;
    background: var(--bg-emerald-soft);
    color: var(--emerald-dark);
    font-weight: 800;
  }

  .stat-value {
    margin: 12px 0 6px;
    font-size: 23px;
    font-weight: 900;
    color: var(--ink-primary);
  }

  .stat-detail {
    font-size: 12px;
    color: var(--ink-muted);
  }

  .emerald-value,
  .positive {
    color: var(--emerald-dark);
  }

  .negative {
    color: var(--danger);
  }

  .dashboard-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 18px;
  }

  .surface {
    background: var(--bg-surface);
    border: 1px solid var(--border-card);
    border-radius: 22px;
    padding: 22px;
    box-shadow: 0 8px 24px rgba(15, 23, 42, 0.03);
  }

  .section-gap {
    margin-top: 20px;
  }

  .surface-heading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;
  }

  .surface-heading h3 {
    margin: 0;
    font-size: 17px;
    font-weight: 800;
  }

  .surface-heading p {
    margin: 3px 0 0;
    font-size: 13px;
    color: var(--ink-muted);
  }

  .small-link {
    background: none;
    border: none;
    color: var(--emerald-dark);
    font-weight: 800;
    font-size: 13px;
    cursor: pointer;
  }

  .category-preview {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .category-line-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
    font-size: 14px;
  }

  .category-name {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-weight: 700;
  }

  .progress-track {
    width: 100%;
    height: 8px;
    border-radius: 999px;
    background: var(--bg-soft);
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, var(--emerald-primary), var(--mint-accent));
  }

  .compact-list,
  .transaction-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .compact-row,
  .transaction-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 14px;
    border-radius: 14px;
    background: var(--bg-canvas);
    border: 1px solid var(--border-card);
  }

  .compact-icon,
  .transaction-icon {
    width: 38px;
    height: 38px;
    border-radius: 12px;
    display: grid;
    place-items: center;
    background: var(--bg-surface);
    border: 1px solid var(--border-card);
    font-size: 17px;
    flex-shrink: 0;
  }

  .compact-info {
    flex: 1;
    min-width: 0;
  }

  .compact-info strong,
  .transaction-left strong {
    display: block;
    font-size: 14px;
    color: var(--ink-primary);
  }

  .compact-info span,
  .transaction-left span {
    display: block;
    font-size: 12px;
    color: var(--ink-muted);
  }

  .transaction-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .transaction-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .icon-action {
    width: 32px;
    height: 32px;
    border-radius: 10px;
    border: 1px solid var(--border-card);
    background: var(--bg-surface);
    color: var(--ink-primary);
    font-weight: 700;
    cursor: pointer;
  }

  .icon-action.danger-action:hover {
    background: var(--danger-bg);
    border-color: var(--danger);
    color: var(--danger);
  }

  .pay-btn {
    padding: 7px 12px;
    border-radius: 10px;
    border: 1px solid var(--emerald-primary);
    background: var(--bg-emerald-soft);
    color: var(--emerald-deep);
    font-weight: 800;
    font-size: 12px;
    cursor: pointer;
  }

  .pay-btn:hover {
    background: var(--emerald-primary);
    color: #ffffff;
  }

  .quick-actions {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
    margin-top: 20px;
  }

  .quick-action {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 16px 18px;
    border-radius: 18px;
    background: var(--bg-surface);
    border: 1px solid var(--border-card);
    text-align: left;
    cursor: pointer;
    transition: border-color 0.15s ease, transform 0.12s ease;
  }

  .quick-action:hover {
    border-color: var(--emerald-primary);
    transform: translateY(-1px);
  }

  .quick-action strong {
    display: block;
    font-size: 14px;
    color: var(--ink-primary);
  }

  .quick-action small {
    display: block;
    font-size: 12px;
    color: var(--ink-muted);
  }

  .quick-action b {
    margin-left: auto;
    color: var(--emerald-dark);
  }

  .quick-icon {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    display: grid;
    place-items: center;
    font-weight: 900;
    flex-shrink: 0;
  }

  .emerald-bg {
    background: var(--bg-emerald-soft);
    color: var(--emerald-dark);
  }

  .mint-bg {
    background: var(--bg-mint-soft);
    color: var(--mint-accent);
  }

  .red-bg {
    background: var(--danger-bg);
    color: var(--danger);
  }

  .expense-total-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 24px 28px;
    border-radius: 22px;
    background: linear-gradient(120deg, #ffffff 0%, var(--bg-emerald-soft) 100%);
    border: 1px solid var(--border-emerald);
  }

  .expense-total-value {
    font-size: 30px;
    font-weight: 900;
    margin: 6px 0;
    color: var(--ink-primary);
  }

  .expense-total-icon {
    width: 52px;
    height: 52px;
    border-radius: 16px;
    display: grid;
    place-items: center;
    background: var(--bg-emerald-soft);
    border: 1px solid var(--border-emerald);
    color: var(--emerald-dark);
    font-size: 22px;
    font-weight: 900;
  }

  .expense-category-grid,
  .history-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
  }

  .expense-category-card,
  .history-card {
    background: var(--bg-surface);
    border: 1px solid var(--border-card);
    border-radius: 18px;
    padding: 18px;
  }

  .expense-category-top,
  .history-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }

  .large-emoji {
    font-size: 22px;
  }

  .category-percent {
    padding: 4px 10px;
    border-radius: 999px;
    background: var(--bg-emerald-soft);
    color: var(--emerald-deep);
    font-size: 12px;
    font-weight: 800;
  }

  .expense-category-value {
    font-size: 20px;
    font-weight: 900;
    margin: 8px 0 10px;
  }

  .category-hint {
    display: block;
    margin-top: 8px;
    font-size: 12px;
    color: var(--ink-muted);
  }

  .toggle-tabs {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    margin-bottom: 16px;
    padding: 5px;
    border-radius: 14px;
    background: var(--bg-soft);
  }

  .toggle-tabs.filter-tabs {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .toggle-tabs button {
    padding: 10px;
    border-radius: 10px;
    border: none;
    background: transparent;
    color: var(--ink-secondary);
    font-weight: 700;
    cursor: pointer;
  }

  .toggle-tabs button.active {
    background: var(--bg-surface);
    color: var(--ink-primary);
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);
  }

  .toggle-tabs button.income-tab.active {
    background: var(--bg-emerald-soft);
    color: var(--emerald-deep);
    font-weight: 800;
  }

  .toggle-tabs button.expense-tab.active {
    background: var(--danger-bg);
    color: var(--danger);
    font-weight: 800;
  }

  .mini-stat {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 0;
    border-bottom: 1px solid var(--border-card);
    font-size: 14px;
  }

  .mini-stat.total-mini {
    border-bottom: none;
    padding-top: 14px;
    font-size: 15px;
  }

  .chat-thread {
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-height: 360px;
    overflow-y: auto;
    margin-bottom: 16px;
  }

  .chat-bubble {
    padding: 14px 16px;
    border-radius: 16px;
    max-width: 82%;
  }

  .chat-bubble.ai-bubble {
    background: var(--bg-emerald-soft);
    border: 1px solid var(--border-emerald);
    align-self: flex-start;
  }

  .chat-bubble.user-bubble {
    background: var(--ink-primary);
    color: #ffffff;
    align-self: flex-end;
  }

  .chat-role {
    display: block;
    font-size: 11px;
    font-weight: 800;
    opacity: 0.75;
    margin-bottom: 4px;
  }

  .chat-bubble p {
    margin: 0;
    font-size: 14px;
    line-height: 1.45;
  }

  .chat-form {
    display: flex;
    gap: 10px;
  }

  .compact-btn {
    white-space: nowrap;
  }

  .family-copy {
    margin: 0;
    font-size: 14px;
    line-height: 1.6;
    color: var(--ink-secondary);
  }

  .code-text {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12px;
  }

  .empty-state {
    padding: 28px 18px;
    text-align: center;
    color: var(--ink-muted);
    font-size: 14px;
    background: var(--bg-canvas);
    border-radius: 16px;
    border: 1px dashed var(--border-card);
  }

  .notice {
    margin-top: 14px;
    padding: 12px 14px;
    border-radius: 12px;
    background: var(--bg-emerald-soft);
    border: 1px solid var(--border-emerald);
    color: var(--emerald-deep);
    font-size: 13px;
    font-weight: 700;
  }

  .global-notice {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0 0 20px;
  }

  .global-notice button {
    margin-left: auto;
    background: none;
    border: none;
    font-size: 18px;
    font-weight: 800;
    color: inherit;
    cursor: pointer;
  }

  @media (max-width: 1180px) {
    .page-heading {
      flex-wrap: wrap;
    }

    .agent-banner {
      order: 3;
      max-width: 100%;
      width: 100%;
    }
  }

  @media (max-width: 1024px) {
    .stats-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .dashboard-grid,
    .quick-actions,
    .expense-category-grid,
    .history-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 820px) {
    .sidebar {
      display: none;
    }

    .app-shell {
      flex-direction: column;
    }

    .main-area {
      padding: 16px 16px 40px;
    }

    .mobile-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }

    .mobile-exit {
      padding: 8px 12px;
      border-radius: 10px;
      border: 1px solid var(--border-card);
      background: var(--bg-surface);
      font-weight: 700;
      font-size: 12px;
    }

    .mobile-nav-strip {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      padding-bottom: 10px;
      margin-bottom: 16px;
    }

    .mobile-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
      padding: 8px 12px;
      border-radius: 999px;
      border: 1px solid var(--border-card);
      background: var(--bg-surface);
      font-size: 12px;
      font-weight: 700;
      color: var(--ink-secondary);
    }

    .mobile-pill.active {
      background: var(--emerald-primary);
      border-color: var(--emerald-dark);
      color: #ffffff;
      font-weight: 800;
    }

    .page-heading {
      flex-direction: column;
      align-items: stretch;
    }
  }
`;
