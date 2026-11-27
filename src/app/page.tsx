
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

/* ===== DR DIAS - WHITE & GREEN ===== */

:root {
  color-scheme: light;
  --bg: #f4f8f5;
  --panel: #ffffff;
  --panel-2: #edf6ef;
  --border: #e1ebe3;
  --text: #26382d;
  --muted: #78877c;
  --green: #268653;
  --green-dark: #e2f3e7;
  --red: #d45d5d;
  --gold: #bd9140;
}

html, body {
  background: var(--bg);
  color: var(--text);
}

.app-shell {
  background: #f4f8f5;
}

.sidebar {
  background: #ffffff;
  border-right: 1px solid #e5eee7;
}

.brand h1 {
  color: #245b3b;
}

.brand p {
  color: #829187;
}

.brandmark {
  background: linear-gradient(145deg, #c9f0d2, #8fd6a3);
  color: #185b34;
  box-shadow: 0 5px 18px #62b97b22;
}

.nav-caption,
.eyebrow {
  color: #7d9684;
}

.nav-item {
  color: #66766b;
}

.nav-item:hover {
  background: #f0f7f1;
  color: #245b3b;
}

.nav-item.selected {
  background: #e8f5eb;
  color: #247448;
  box-shadow: inset 3px 0 #56ad70;
}

.nav-icon {
  color: #57966a;
}

.nav-indicator {
  background: #55ad70;
}

.wallet-mini {
  background: #f5faf6;
  border-color: #e0ebe2;
}

.wallet-mini-icon {
  background: #e2f3e7;
  color: #328352;
}

.wallet-mini strong {
  color: #345640;
}

.wallet-mini div:nth-child(2) span {
  color: #839287;
}

.logout-btn {
  color: #78877c;
}

.main-area {
  background: #f4f8f5;
}

.page-heading h1 {
  color: #243b2c;
}

.page-heading p {
  color: #78877c;
}

.user-chip {
  background: #ffffff;
  border-color: #e1ebe3;
  color: #53685a;
}

.user-avatar {
  background: #e4f4e8;
  color: #328352;
}

.welcome-strip {
  background: linear-gradient(110deg, #e5f5e9, #f3faf4);
  border: 1px solid #d5ead9;
}

.welcome-strip h2 {
  color: #245b3b;
}

.welcome-strip p {
  color: #6d8373;
}

.welcome-mark {
  color: #9bcca51f;
}

.section-title-row h2 {
  color: #304638;
}

.section-title-row p {
  color: #849187;
}

.period-pill,
.count-pill {
  background: #edf7ef;
  border-color: #dcecdf;
  color: #388354;
}

.stat-card,
.surface,
.expense-category-card {
  background: #ffffff;
  border-color: #e3ece5;
  box-shadow: 0 4px 16px #244d3010;
}

.stat-card:hover,
.surface:hover {
  border-color: #c4dfca;
}

.stat-top {
  color: #758579;
}

.stat-symbol {
  background: #eaf6ed;
  color: #398557;
}

.stat-value,
.white-value {
  color: #294c36;
}

.stat-detail {
  color: #8b988e;
}

.positive {
  color: #268653 !important;
}

.negative {
  color: #d45d5d !important;
}

.surface-heading h3 {
  color: #304638;
}

.surface-heading p {
  color: #89968d;
}

.small-link {
  color: #328352;
}

.category-name {
  color: #405a48;
}

.category-line-top strong {
  color: #385441;
}

.category-emoji,
.compact-icon,
.transaction-icon {
  background: #edf6ef;
  border: 1px solid #e1eee4;
}

.compact-row {
  border-bottom-color: #edf1ed;
}

.compact-info strong,
.transaction-left strong {
  color: #344c3b;
}

.compact-info span,
.transaction-left span {
  color: #89968d;
}

.progress-track {
  background: #e9f0ea;
}

.progress-fill {
  background: linear-gradient(90deg, #78c98b, #a8e4b5);
  box-shadow: none;
}

.quick-action {
  background: #ffffff;
  border-color: #e1ebe3;
  color: #344c3b;
}

.quick-action:hover {
  border-color: #a8d7b3;
  background: #fafffb;
}

.quick-action small {
  color: #87958b;
}

.red-bg {
  background: #fff0ef;
  color: #d45d5d;
}

.green-bg {
  background: #e7f6eb;
  color: #328352;
}

.gold-bg {
  background: #fbf5e8;
  color: #b58a3e;
}

.month-filter {
  background: #ffffff;
  border-color: #dce8de;
  color: #344c3b;
}

.expense-total-card {
  background: linear-gradient(110deg, #fff4f2, #fffafa);
  border-color: #f1dedb;
}

.expense-total-value {
  color: #c85e58;
}

.expense-total-card p {
  color: #9a817e;
}

.expense-total-icon {
  background: #fbe8e6;
  color: #c85e58;
}

.category-percent {
  color: #398557;
}

.expense-category-value {
  color: #345640;
}

.category-hint {
  color: #89968d;
}

.transaction-row {
  border-bottom-color: #edf1ed;
}

.icon-action {
  background: #f4f8f5;
  border-color: #dce8de;
  color: #587060;
}

.danger-action {
  color: #d45d5d;
}

.toggle-tabs {
  background: #f3f7f4;
  border-color: #e2ebe4;
}

.toggle-tabs button {
  color: #718176;
}

.toggle-tabs button.active {
  background: #e0f1e4;
  color: #267447;
}

.toggle-tabs button.expense-tab.active {
  background: #fff0ef;
  color: #c85e58;
}

.toggle-tabs button.income-tab.active {
  background: #e2f4e7;
  color: #267447;
}

.field label {
  color: #53685a;
}

.field input,
.field select,
.assistant-input input {
  background: #ffffff;
  border-color: #dce8de;
  color: #304638;
}

.field input::placeholder,
.assistant-input input::placeholder {
  color: #a0aaa2;
}

.field input:focus,
.field select:focus,
.assistant-input input:focus {
  border-color: #70bd83;
  box-shadow: 0 0 0 3px #70bd831c;
}

.primary-btn {
  background: linear-gradient(135deg, #a8e5b5, #82d397);
  border-color: #91d6a1;
  color: #185b34;
  box-shadow: 0 4px 13px #65b97d20;
}

.primary-btn:hover {
  background: #b9edc3;
}

.secondary-btn {
  background: #edf7ef;
  border-color: #d4e9d9;
  color: #287648;
}

.mini-stat {
  border-bottom-color: #edf1ed;
  color: #718176;
}

.mini-stat strong {
  color: #345640;
}

.total-mini {
  color: #345640;
}

.bill-row {
  background: #fbfdfb;
  border-color: #e3ece5;
}

.bill-info > strong:first-child {
  color: #344c3b;
}

.bill-info > span {
  color: #89968d;
}

.bill-amount {
  color: #345640;
}

.mini-primary {
  background: #dff2e4;
  color: #267447;
}

.mini-delete {
  background: #fff0ef;
  color: #c85e58;
}

.footnote {
  color: #89968d;
}

.assistant-panel {
  background: radial-gradient(circle at 50% 0%, #e5f5e9, #ffffff 65%);
  border-color: #dcecdf;
  box-shadow: 0 5px 20px #244d3010;
}

.assistant-orb {
  background: #e0f2e5;
  border-color: #c5e5cc;
  color: #328352;
}

.assistant-panel h2 {
  color: #294c36;
}

.assistant-panel > p {
  color: #78877c;
}

.chatbubble {
  background: #ffffff;
  border-color: #e1ebe3;
  color: #405a48;
}

.suggestion-row button {
  background: #f0f8f2;
  border-color: #dcecdf;
  color: #328352;
}

.family-card {
  background: linear-gradient(120deg, #e5f5e9, #f7fbf7);
  border-color: #d5ead9;
}

.family-heart {
  background: #d8efde;
  color: #328352;
}

.family-card h2 {
  color: #294c36;
}

.family-card p,
.muted-text {
  color: #6f8274;
}

.family-status {
  background: #f4fbf5;
  border-color: #cfe6d4;
  color: #328352;
}

.profile-avatar {
  background: #e5f4e8;
  color: #328352;
}

.profile-row strong {
  color: #344c3b;
}

.profile-row div span {
  color: #89968d;
}

.empty-state {
  border-color: #dce8de;
  color: #89968d;
}

.app-footer {
  border-top-color: #e1ebe3;
  color: #91a096;
}

.notice {
  background: #fff8e8;
  border-color: #efdfb9;
  color: #876a2d;
}

.global-notice button {
  color: #876a2d;
}

.auth-screen {
  background: radial-gradient(circle at 50% 0%, #e4f4e8, #f4f8f5 60%);
}

.auth-card {
  background: #ffffff;
  border-color: #e1ebe3;
  box-shadow: 0 20px 65px #244d3014;
}

.auth-intro h2 {
  color: #294c36;
}

.auth-intro p {
  color: #78877c;
}

.text-btn {
  color: #328352;
}

.separator {
  color: #89968d;
}

.separator:before,
.separator:after {
  background: #e4ece5;
}

@media (max-width: 760px) {
  .mobile-exit {
    background: #ffffff;
    border-color: #dce8de;
    color: #328352;
  }
}
`;
