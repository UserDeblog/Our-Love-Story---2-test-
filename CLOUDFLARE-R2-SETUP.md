# Cloudflare R2 para a galeria

Esta configuração move uploads, arquivos e metadados da galeria para Cloudflare R2 + D1, usando um Worker como API segura. As chaves do R2 ficam no Cloudflare e não são colocadas no site. O bucket R2 permanece privado; o Worker entrega os arquivos e permite vídeos com busca/avanço.

## 1. Criar o armazenamento

1. Crie ou entre na sua conta Cloudflare e abra **R2 Object Storage**.
2. Crie um bucket chamado `our-love-story-media`. Deixe o acesso público do bucket desligado; o Worker fornece as URLs públicas necessárias para a galeria.
3. Abra **D1 SQL Database** e crie um banco chamado `our-love-story-data`.
4. No console SQL do D1, execute todo o arquivo `cloudflare/schema.sql`.

R2 tem franquia mensal gratuita de armazenamento e operações, com saída de dados sem cobrança de egress dentro dos termos atuais. Confira o painel de uso da Cloudflare antes de publicar muitas mídias: https://developers.cloudflare.com/r2/pricing/.

## 2. Publicar o Worker

O caminho mais direto é usar Wrangler no terminal, dentro da pasta do projeto:

```powershell
npx wrangler login
npx wrangler r2 bucket create our-love-story-media
npx wrangler d1 create our-love-story-data
```

Copie a saída `database_id` do último comando para `cloudflare/wrangler.toml.example` e salve uma cópia como `cloudflare/wrangler.toml`. Troque `SEU_USUARIO` em `ALLOWED_ORIGINS` pelo usuário do GitHub Pages. Os valores são origens separadas por vírgula, sem caminho do repositório. Se o site usa domínio próprio, substitua a origem do GitHub pela origem do seu domínio. As duas origens `capacitor://localhost` e `https://localhost` permitem o app móvel Capacitor.

Na pasta `cloudflare`, execute:

```powershell
npx wrangler d1 execute our-love-story-data --remote --file schema.sql
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put SESSION_SECRET
npx wrangler deploy
```

Ao pedir `ADMIN_PASSWORD`, digite uma senha longa e exclusiva para administrar a galeria. Para `SESSION_SECRET`, use outra sequência aleatória longa. Não coloque essas senhas no site, no GitHub ou neste arquivo. Os dois usuários do casal usarão a senha de administração da galeria.

Se Wrangler pedir para criar os recursos que você já criou no painel, confirme que está usando a mesma conta Cloudflare e o mesmo bucket/banco. No primeiro comando `wrangler d1 execute`, confira se o banco selecionado é `our-love-story-data`.

Depois do deploy, anote o endereço terminado em `.workers.dev` mostrado pelo Wrangler.

## 3. Ligar o site ao Worker

Abra `cloudflare-config.js` e coloque o endereço do Worker, sem barra no final:

```js
window.CLOUDFLARE_MEDIA_API = "https://seu-worker.seu-subdominio.workers.dev";
```

Publique `cloudflare-config.js`, `script.js`, `index.html` e `style.css` pelo GitHub Pages. Se você também usa o app Capacitor, gere novamente a pasta web com `npm run build` antes de sincronizar o app; o script de build agora inclui a configuração do Worker. No celular, abra **Nossos momentos**, digite a senha de administração da galeria e toque em **ENTRAR**. A sessão fica só naquele navegador por até 12 horas. Depois disso, entre novamente. Envio e exclusão de fotos/vídeos exigem essa senha; visualizar a galeria não exige login.

## 4. Dados antigos e Supabase

O site passa a buscar e gravar novas mídias da galeria no R2/D1. Os arquivos já enviados ao Supabase não são copiados automaticamente: mantenha o projeto Supabase ativo até exportar e migrar os arquivos antigos, ou eles deixam de aparecer nesta galeria enquanto este código estiver usando o Worker.

Isto migra somente a **galeria de fotos e vídeos**. Cartinhas, notícias, mapa, checklist, cápsulas, ideias de encontros, localização e outros dados ainda usam Supabase. R2 guarda arquivos, mas não substitui sozinho um banco relacional nem a autenticação. Para remover completamente o Supabase, o restante desses recursos também precisa ser migrado para D1 e para as rotas do Worker. Não apague nem pause o projeto antes de exportar esses dados.

## Limites atuais

- O formulário aceita imagens e vídeos de até 95 MiB (aprox. 100 MB), para respeitar o limite de requisição de 100 MB do plano Cloudflare Free. A conta Workers Free permite até 100.000 requisições por dia; visualização de cada arquivo passa pelo Worker.
- O endpoint do Worker valida tipo, tamanho, categoria e senha de administrador.
- Galeria pública significa que qualquer pessoa com o link do site pode abrir os arquivos da galeria. Não envie mídia que precise permanecer privada.
- A barra de volume do mixer controla somente músicas locais, não o áudio de vídeos da galeria.
