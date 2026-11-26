# DR DIAS FINANCEIRO IA — início gratuito

Este projeto é a primeira base funcional do sistema: login por e-mail/senha, carteira familiar compartilhada, receitas/despesas, sincronização em tempo real e assistente inicial gratuito (regras locais, sem API paga).

## O que é grátis
- Next.js: framework gratuito.
- Supabase Free: autenticação e banco de dados com limites gratuitos.
- Vercel Hobby: hospedagem para uso pessoal, sujeita aos termos e limites do plano.
- PWA: instalação pelo navegador no celular.

Serviços gratuitos têm limites e podem mudar seus planos/termos. Não há cobrança automática configurada neste projeto. Não coloque dados bancários reais até revisar e testar tudo.

## 1. Criar o banco
1. Crie uma conta no Supabase e um projeto gratuito.
2. Abra **SQL Editor > New query**.
3. Copie todo o conteúdo de `supabase/schema.sql` e execute.
4. Em **Project Settings > API**, copie a Project URL e a chave `anon`/publishable.

## 2. Configurar o site
1. Instale Node.js LTS no computador.
2. Extraia o ZIP.
3. Na pasta do projeto, copie `.env.example` para `.env.local`.
4. Preencha `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
5. Abra o terminal nessa pasta e execute:
   ```bash
   npm install
   npm run dev
   ```
6. Acesse http://localhost:3000.

## 3. Criar os dois acessos
1. Na tela do site, selecione **Criar conta** e cadastre o primeiro e-mail/senha.
2. Se o Supabase exigir confirmação de e-mail, confirme pelo e-mail recebido.
3. Entre e clique em **Criar carteira familiar**.
4. No Supabase, abra **Table Editor > wallets** e copie o `invite_code` da carteira recém-criada.
5. No site, saia da primeira conta.
6. Crie a conta da sua esposa com outro e-mail/senha, confirme o e-mail se solicitado.
7. Na tela inicial, cole o código no campo **Código de convite** e entre na carteira existente.

A carteira permite no máximo dois usuários. Os dois podem adicionar e excluir lançamentos.

## 4. Publicar gratuitamente e acessar em qualquer lugar
1. Crie uma conta no GitHub e envie os arquivos deste projeto para um repositório privado.
2. Crie uma conta na Vercel e importe o repositório.
3. Nas variáveis de ambiente da Vercel, configure as mesmas duas variáveis Supabase.
4. Faça o deploy. A Vercel fornecerá um endereço HTTPS.
5. Abra esse endereço no celular e use **Adicionar à tela inicial** no menu do navegador.

## Limitações desta primeira versão
- O assistente é gratuito e faz cálculos/análises simples a partir dos lançamentos carregados; ainda não é um modelo generativo de conversa.
- Os lançamentos mostram os registros recentes e totais desses registros, não um extrato bancário.
- A tela de convite usa o painel Supabase para obter o código.
- Não há conexão automática com bancos, importação de extratos, notificações push ou recuperação de senha personalizada nesta primeira entrega.
- Antes de usar com dados reais, valide permissões, regras de acesso, backups e políticas de privacidade.

## Segurança
Nunca compartilhe a chave `service_role` do Supabase. O site usa somente a chave pública `anon`/publishable; as regras RLS do banco protegem os dados da carteira. Use senhas fortes e ative confirmação de e-mail.
