# SimplificaPDV

Sistema de Ponto de Venda (PDV) desktop, construÃƒÂ­do em **Tauri 2 + React + SQLite local**.
NÃƒÂ£o ÃƒÂ© um sistema web: ÃƒÂ© um programa instalÃƒÂ¡vel (Windows/Linux/macOS) com banco de dados
gravado no prÃƒÂ³prio computador do usuÃƒÂ¡rio, e atualizaÃƒÂ§ÃƒÂ£o remota assinada via `latest.json`.

## Stack

- **Frontend**: React + TypeScript + Vite + Tailwind (paleta verde da identidade SimplificaPDV)
- **Backend**: Rust (Tauri), com `rusqlite` (SQLite embutido, sem instalaÃƒÂ§ÃƒÂ£o externa)
- **AtualizaÃƒÂ§ÃƒÂ£o remota**: `tauri-plugin-updater`, com verificaÃƒÂ§ÃƒÂ£o de assinatura (Ed25519)
- **Banco de dados**: arquivo `.db` salvo em:
  - Windows: `%APPDATA%\com.simplificapdv.app\simplificapdv.db`
  - Linux: `~/.local/share/com.simplificapdv.app/simplificapdv.db`
  - macOS: `~/Library/Application Support/com.simplificapdv.app/simplificapdv.db`

## Funcionalidades incluÃƒÂ­das (MVP)

- **PDV**: busca de produto, carrinho, formas de pagamento, finalizaÃƒÂ§ÃƒÂ£o de venda com baixa automÃƒÂ¡tica de estoque (tudo em transaÃƒÂ§ÃƒÂ£o atÃƒÂ´mica no SQLite).
- **Produtos**: cadastro, ediÃƒÂ§ÃƒÂ£o, exclusÃƒÂ£o (soft delete), cÃƒÂ³digo de barras.
- **Estoque**: ajuste manual de quantidade (entrada/saÃƒÂ­da) com motivo, alerta de estoque baixo.
- **Clientes**: cadastro bÃƒÂ¡sico (nome, telefone, CPF/CNPJ).
- **RelatÃƒÂ³rios**: vendas dos ÃƒÂºltimos 7 dias e produtos mais vendidos.
- **ConfiguraÃƒÂ§ÃƒÂµes**: versÃƒÂ£o instalada + botÃƒÂ£o "Verificar atualizaÃƒÂ§ÃƒÂµes" (e checagem silenciosa automÃƒÂ¡tica ao abrir o app).

Isso ÃƒÂ© uma base sÃƒÂ³lida para vocÃƒÂª expandir (nota fiscal, mÃƒÂºltiplos usuÃƒÂ¡rios/permissÃƒÂµes, caixa/sangria, impressÃƒÂ£o de cupom, etc).

---

## 1. PrÃƒÂ©-requisitos

Instale na sua mÃƒÂ¡quina de desenvolvimento:

- [Node.js](https://nodejs.org) 18+
- [Rust](https://www.rust-lang.org/tools/install) (via `rustup`)
- DependÃƒÂªncias do sistema do Tauri para o seu SO: veja https://v2.tauri.app/start/prerequisites/
  (no Linux geralmente precisa de `webkit2gtk`, `libayatana-appindicator3`, etc.)

## 2. Rodando em desenvolvimento

```bash
npm install
npm run tauri dev
```

Isso abre a janela nativa do app jÃƒÂ¡ conectada ao SQLite local (criado automaticamente na primeira execuÃƒÂ§ÃƒÂ£o, com 3 produtos de exemplo).

## 3. Gerando o instalador (build de produÃƒÂ§ÃƒÂ£o)

```bash
npm run tauri build
```

Os instaladores ficam em `src-tauri/target/release/bundle/` (um `.exe`/`.msi` no Windows, `.AppImage`/`.deb` no Linux, `.app`/`.dmg` no macOS).

Antes de buildar para valer, gere os ÃƒÂ­cones reais (veja `src-tauri/icons/LEIA-ME.txt`).

---

## 4. Configurando a atualizaÃƒÂ§ÃƒÂ£o automÃƒÂ¡tica remota

Isso ÃƒÂ© o coraÃƒÂ§ÃƒÂ£o do seu pedido: vocÃƒÂª quer subir uma nova versÃƒÂ£o, atualizar o `latest.json`
no seu servidor, e o app dos usuÃƒÂ¡rios se atualiza sozinho Ã¢â‚¬â€ sempre validando a assinatura
antes de instalar (evita que alguÃƒÂ©m sirva um update malicioso).

### 4.1. Gerar o par de chaves de assinatura (uma ÃƒÂºnica vez)

```bash
npx @tauri-apps/cli signer generate -w ~/.tauri/simplificapdv.key
```

Isso gera:
- `~/.tauri/simplificapdv.key` Ã¢â€ â€™ **chave privada**. Guarde em local seguro, nunca comite no git. Ãƒâ€° ela que assina cada build.
- Uma **chave pÃƒÂºblica** impressa no terminal (uma string longa em base64).

Cole a chave pÃƒÂºblica em `src-tauri/tauri.conf.json`, no campo:

```json
"plugins": {
  "updater": {
    "pubkey": "COLE_AQUI_A_CHAVE_PUBLICA_GERADA_PELO_TAURI_SIGNER",
    ...
  }
}
```

### 4.2. Configurar variÃƒÂ¡veis de ambiente para assinar o build

Antes de rodar `npm run tauri build`, exporte:

```bash
export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/simplificapdv.key)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="a-senha-que-voce-definiu-ao-gerar-a-chave"
```

Com isso, o `npm run tauri build` jÃƒÂ¡ gera automaticamente, alÃƒÂ©m dos instaladores, os arquivos
`.sig` (assinatura) de cada artefato Ã¢â‚¬â€ graÃƒÂ§as ÃƒÂ  opÃƒÂ§ÃƒÂ£o `"createUpdaterArtifacts": true` que jÃƒÂ¡
estÃƒÂ¡ configurada em `tauri.conf.json`.

### 4.3. Apontar o app para onde o `latest.json` vai morar

Em `src-tauri/tauri.conf.json`, ajuste o endpoint:

```json
"endpoints": ["https://seu-dominio.com/updates/latest.json"]
```

Pode ser qualquer lugar que sirva um arquivo estÃƒÂ¡tico por HTTPS: seu prÃƒÂ³prio servidor,
um bucket S3/Cloudflare R2, GitHub Releases, etc.

### 4.4. Publicando uma nova versÃƒÂ£o

Toda vez que quiser lanÃƒÂ§ar uma atualizaÃƒÂ§ÃƒÂ£o:

1. Suba o nÃƒÂºmero de versÃƒÂ£o em **dois lugares** (mantenha sempre iguais):
   - `src-tauri/tauri.conf.json` Ã¢â€ â€™ campo `"version"`
   - `package.json` Ã¢â€ â€™ campo `"version"`
2. Rode `npm run tauri build` (com as variÃƒÂ¡veis de ambiente da chave setadas).
3. Pegue os arquivos gerados em `src-tauri/target/release/bundle/` Ã¢â‚¬â€ o instalador e o `.sig` correspondente.
4. Suba o instalador para o seu servidor/storage.
5. Edite o `latest.json` (modelo em `latest.json.exemplo` na raiz do projeto) com:
   - a nova `"version"`
   - o conteÃƒÂºdo do arquivo `.sig` no campo `"signature"` da plataforma correspondente
   - a URL pÃƒÂºblica do instalador no campo `"url"`
6. Suba o `latest.json` atualizado no mesmo endpoint configurado no passo 4.3.

Pronto Ã¢â‚¬â€ na prÃƒÂ³xima vez que o app abrir (ou quando o usuÃƒÂ¡rio clicar em "Verificar
atualizaÃƒÂ§ÃƒÂµes" na tela de ConfiguraÃƒÂ§ÃƒÂµes), ele vai:
1. Baixar o `latest.json`
2. Comparar a versÃƒÂ£o remota com a instalada
3. Se for maior, baixar o instalador, **validar a assinatura com a chave pÃƒÂºblica**
4. Instalar e reiniciar o app automaticamente

Se a assinatura nÃƒÂ£o bater (arquivo adulterado, chave errada etc.), o Tauri **recusa a
atualizaÃƒÂ§ÃƒÂ£o** Ã¢â‚¬â€ por isso ÃƒÂ© essencial manter a chave privada em seguranÃƒÂ§a.

---

## 5. Estrutura do projeto

```
simplificapdv/
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ src/                     # Frontend React
Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ pages/               # PDV, Produtos, Estoque, Clientes, RelatÃƒÂ³rios, ConfiguraÃƒÂ§ÃƒÂµes
Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ components/          # Sidebar etc.
Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ lib/api.ts           # chamadas invoke() para o backend Rust
Ã¢â€â€š   Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ lib/updater.ts       # lÃƒÂ³gica de checar/baixar/instalar atualizaÃƒÂ§ÃƒÂ£o
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ src-tauri/
Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ src/
Ã¢â€â€š   Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ main.rs          # registra plugins e comandos
Ã¢â€â€š   Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ db.rs            # conexÃƒÂ£o SQLite + migraÃƒÂ§ÃƒÂµes + seed inicial
Ã¢â€â€š   Ã¢â€â€š   Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ commands/        # products.rs, customers.rs, sales.rs, reports.rs
Ã¢â€â€š   Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ tauri.conf.json      # config do app + updater (endpoints, pubkey)
Ã¢â€â€š   Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ capabilities/        # permissÃƒÂµes dos plugins (Tauri v2)
Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ latest.json.exemplo      # modelo do arquivo que fica hospedado remotamente
Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ package.json
```

## 6. Licenciamento (controle de quem usa o sistema)

Se vocÃƒÂª vai **vender o sistema**, o app tem um sistema de licenciamento por ativaÃƒÂ§ÃƒÂ£o
online via **Supabase** (hospedado, sem servidor seu), alÃƒÂ©m de login local de operadores.

### Como funciona

1. **AtivaÃƒÂ§ÃƒÂ£o**: na primeira execuÃƒÂ§ÃƒÂ£o, o app pede uma chave de licenÃƒÂ§a. A chave ÃƒÂ©
   validada no seu projeto Supabase e vinculada ÃƒÂ  mÃƒÂ¡quina (id persistente da instalaÃƒÂ§ÃƒÂ£o).
2. **VerificaÃƒÂ§ÃƒÂ£o periÃƒÂ³dica**: enquanto o app roda, ele revalida a licenÃƒÂ§a online a cada
   5 minutos. Se a licenÃƒÂ§a for revogada ou expirar, o app **bloqueia**.
3. **CarÃƒÂªncia offline**: se o computador ficar sem internet, o app aceita a ÃƒÂºltima
   verificaÃƒÂ§ÃƒÂ£o vÃƒÂ¡lida por atÃƒÂ© **15 dias**, sem ultrapassar o vencimento da licenÃƒÂ§a.
4. **Painel master do vendedor**: o link **Acesso do vendedor** abre um login separado
   em `#/vendedor`. A senha ÃƒÂ© validada pelo Supabase antes de abrir LicenÃƒÂ§as.
   A conta local da loja nÃƒÂ£o concede esse acesso. A senha master ÃƒÂ© definida somente
   pelo SQL Editor do Supabase; o aplicativo nÃƒÂ£o oferece cadastro de vendedor.
5. **Login de operadores**: cada loja cria seus operadores com papÃƒÂ©is
   (operador/supervisor/gerente/admin). Sem login, o PDV nÃƒÂ£o abre. Apenas o perfil
   **admin**, identificado como **ResponsÃƒÂ¡vel da loja**, vÃƒÂª UsuÃƒÂ¡rios, ConfiguraÃƒÂ§ÃƒÂµes e Fiscal.
   Ele nÃƒÂ£o pode emitir, revogar ou prorrogar licenÃƒÂ§as. O operador logado ÃƒÂ©
   registrado automaticamente nas vendas e na abertura de caixa.

### 6.1. Criar o projeto no Supabase

1. Crie uma conta grÃƒÂ¡tis em https://supabase.com e um projeto novo.
2. Abra **SQL Editor** e rode o conteÃƒÂºdo de `supabase/schema.sql` (cria as tabelas
   `licenses`, `activations` e as funÃƒÂ§ÃƒÂµes de ativaÃƒÂ§ÃƒÂ£o/admin com RLS).
3. Defina a senha do vendedor rodando no SQL Editor:
   ```sql
   select set_seller_password('', 'MINHA_SENHA_FORTE');
   ```
4. Copie a **URL** e a **chave anon (public)** do projeto em
   *Project Settings Ã¢â€ â€™ API* para o arquivo `.env.local`:
   ```
   VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
   VITE_SUPABASE_ANON_KEY=SUA_CHAVE_ANON
   ```
5. Em desenvolvimento, isso ÃƒÂ© suficiente. **Para o instalador que vocÃƒÂª vende**, rode o
   build com o `.env.local` preenchido Ã¢â‚¬â€ essas duas variÃƒÂ¡veis pÃƒÂºblicas ficam embutidas no app.

> Sem a configuraÃƒÂ§ÃƒÂ£o de licenciamento, o build ÃƒÂ© bloqueado e o aplicativo nÃƒÂ£o libera o PDV.
> NÃƒÂ£o use a chave `service_role` no frontend. Preserve no `.env.local` as variÃƒÂ¡veis
> `TAURI_SIGNING_PRIVATE_KEY` e `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` usadas na assinatura.

Para atualizar um Supabase jÃƒÂ¡ existente, execute no SQL Editor
`supabase/migrations/20260905_seller_access.sql`. A migraÃƒÂ§ÃƒÂ£o preserva senha, licenÃƒÂ§as
e ativaÃƒÂ§ÃƒÂµes, restringe a definiÃƒÂ§ÃƒÂ£o da senha master e rejeita senhas nulas/vazias nas
funÃƒÂ§ÃƒÂµes de administraÃƒÂ§ÃƒÂ£o. NÃƒÂ£o ÃƒÂ© preciso definir outra senha se vocÃƒÂª jÃƒÂ¡ possui uma.

### 6.2. Mensalidades pelo Mercado Pago

Execute `supabase/migrations/20260910_mercadopago.sql` depois das migrations
anteriores. Ela remove os campos e rotinas do gateway anterior, cria os campos do
Mercado Pago, registra webhooks de forma idempotente e cria/renova a licença somente
quando a API confirmar um pagamento aprovado.

Publique as Edge Functions `supabase/functions/create-checkout` e
`supabase/functions/mercadopago-webhook`. Configure os secrets no Supabase:

```text
MP_ACCESS_TOKEN=APP_USR-...
MP_WEBHOOK_SECRET=chave-secreta-gerada-em-Suas-Integracoes
MP_WEBHOOK_URL=https://SEU-PROJETO.supabase.co/functions/v1/mercadopago-webhook
PUBLIC_APP_URL=https://SEU-DOMINIO-DE-RETORNO
PUBLIC_APP_ORIGIN=https://SEU-DOMINIO-DE-RETORNO
SUPABASE_SERVICE_ROLE_KEY=...
```

O checkout usa uma assinatura mensal pendente (`/preapproval`) e redireciona o
cliente para o `init_point` hospedado pelo Mercado Pago. No painel Mercado Pago,
configure pagamentos, `subscription_preapproval` e `subscription_authorized_payment`
quando aplicável. A Edge Function consulta o pagamento recebido antes de atualizar
o banco e valida o header `x-signature` com `MP_WEBHOOK_SECRET`.

Use credenciais de teste e contas de teste primeiro. Para produção, troque pelo
Access Token produtivo e use uma URL HTTPS pública para o webhook e para o retorno.

### 6.3. Fluxo de venda para um cliente

1. Abra **Acesso do vendedor**, informe sua senha master e vÃƒÂ¡ a **LicenÃƒÂ§as Ã¢â€ â€™ Nova LicenÃƒÂ§a**. Informe o cliente
   e quantas mÃƒÂ¡quinas ele pode usar, e o prazo (ex.: 1 ano).
2. Copie a chave gerada e envie ao cliente (junto com o instalador).
3. O cliente instala, abre, digita a chave e escolhe um nome para a mÃƒÂ¡quina. SÃƒÂ³ depois
   da ativaÃƒÂ§ÃƒÂ£o cadastra o responsÃƒÂ¡vel da loja, que pode cadastrar os demais operadores.
4. Para cobrar renovaÃƒÂ§ÃƒÂ£o: **LicenÃƒÂ§as Ã¢â€ â€™ Prorrogar** (ex.: +365 dias) quando vencer.
5. Se o cliente atrasar o pagamento ou repassar o sistema: **LicenÃƒÂ§as Ã¢â€ â€™ Revogar** Ã¢â‚¬â€
   o app dele bloqueia na prÃƒÂ³xima verificaÃƒÂ§ÃƒÂ£o online.
6. Se o cliente trocar de computador: **LicenÃƒÂ§as Ã¢â€ â€™ Liberar** a mÃƒÂ¡quina antiga, e ele
   ativa a nova com a mesma chave (respeitando o limite de mÃƒÂ¡quinas).

### 6.4. Testar o primeiro acesso

Reinstalar o MSI preserva o banco local, os usuÃƒÂ¡rios e a ativaÃƒÂ§ÃƒÂ£o. Para testar uma
instalaÃƒÂ§ÃƒÂ£o nova sem apagar os dados da sua loja, use outro perfil de usuÃƒÂ¡rio do Windows
ou uma mÃƒÂ¡quina virtual. O fluxo esperado ÃƒÂ©: ativar licenÃƒÂ§a Ã¢â€ â€™ cadastrar responsÃƒÂ¡vel da
loja Ã¢â€ â€™ usar o PDV. A senha do responsÃƒÂ¡vel da loja nÃƒÂ£o abre o painel master.

Os testes locais podem ser executados com `bun test tests` e, dentro de `src-tauri`,
`cargo test --bin simplificapdv commands::users::tests`.

### 6.5. Login do cliente por e-mail

O acesso ao PDV usa o **Supabase Auth**. Execute primeiro a migration
`supabase/migrations/20260919_email_auth.sql` no SQL Editor.

Para cada cliente, crie uma conta em **Authentication > Users > Add user** no
Supabase. O e-mail da conta deve ser exatamente igual ao campo `customer_email`
da licença. Na primeira entrada, o app vincula essa conta à licença; depois basta
usar e-mail e senha, sem informar a chave de licença.

> Crie usuários pelo painel Authentication ou por uma API de servidor que use a
> `service_role`. Nunca inclua a `service_role` no aplicativo.

### 6.6. Subcontas para os caixas

Uma licença é da loja, não de um computador. Execute
`supabase/migrations/20260922_store_subaccounts.sql` e publique a função:

```bash
supabase functions deploy manage-store-users
```

Configure `SUPABASE_SERVICE_ROLE_KEY` como secret dessa Edge Function. O dono da
loja passa a ver **Contas dos caixas** e pode criar até a quantidade contratada
de subcontas. Cada subconta usa e-mail e senha próprios e pode trocar de máquina
sem consumir uma nova vaga.

---

## 7. PrÃƒÂ³ximos passos sugeridos

- EmissÃƒÂ£o de cupom fiscal / integraÃƒÂ§ÃƒÂ£o com impressora tÃƒÂ©rmica
- Abertura/fechamento de caixa com sangria e suprimento (jÃƒÂ¡ existe no mÃƒÂ³dulo Caixa)
- Backup automÃƒÂ¡tico do `.db` (ex: cÃƒÂ³pia periÃƒÂ³dica para uma pasta na nuvem do usuÃƒÂ¡rio)
- Suporte a mÃƒÂºltiplos terminais sincronizando com um servidor central (hoje ÃƒÂ© 100% local/single-machine, como pedido)
