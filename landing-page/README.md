# Landing page — Simplifica Oficina

Abra `index.html` no navegador. Para publicar a versão com vídeo, copie estes arquivos para a mesma pasta da hospedagem:

- `index.html`: landing page.
- `download.html`: cópia independente da página de download, com guia de instalação.
- `video-sistema.mp4`: demonstração horizontal, 45 segundos, 1920 × 1080, H.264, sem áudio.
- `video-poster.jpg`: capa do player.
- `video-legendas.vtt`: legendas opcionais em português (servidas pela hospedagem).

O pacote `simplifica-oficina-site-com-video.zip` reúne os arquivos necessários. As versões ZIP anteriores não incluem o vídeo.

O vídeo usa capturas das próprias telas do aplicativo em um ambiente isolado com dados fictícios. Nenhuma conta real ou banco da oficina foi acessado. Títulos, transições e destaques formam a apresentação; não é uma gravação contínua de uma sessão de uso. O player inclui controles, reprodução inline no celular, carregamento sob demanda e transcrição textual. Foram verificados duração, resolução, reprodução e avanço para diferentes pontos do arquivo exportado.

O visual usa Tailwind CSS compilado e incorporado em cada HTML. Não precisa de React, servidor de aplicação ou CDN para o CSS. A landing page carrega a fonte Manrope pelo Google Fonts, com fallback sans-serif se estiver offline. A consulta ao instalador e o download exigem internet.

O plano único é apresentado como assinatura mensal, sem preço publicado. As prévias do sistema são ilustrativas e usam dados fictícios; valores apresentados nelas são exemplos operacionais, não preços da assinatura. Não foram adicionados depoimentos ou números de clientes.

## Redesign

Esta versão foi adaptada da referência enviada pelo proprietário: https://simplificaoficina.netlify.app/ . Preserva a direção visual de abertura escura, grade sutil, laranja, painel em destaque, cards e seções contrastantes. O nome foi ajustado para Simplifica Oficina, os dois planos da referência foram substituídos pelo plano único e os placeholders de vídeo e contato deram lugar a prévias navegáveis e links de download.

Menu mobile, Escape, abas com navegação por setas/Home/End e FAQ foram testados em navegador. Layout verificado em 320, 390, 768, 1024 e 1440 pixels. As animações respeitam a preferência de movimento reduzido e o conteúdo permanece visível sem JavaScript.

`versao-anterior.html` preserva a primeira proposta. Os arquivos `preview-*.png` são capturas locais para revisão, não dependências do site. `check-browser.mjs` é apenas um teste local e não precisa ser publicado.

## Atualizações

Os links de download apontam para `download.html`. Nessa página, `RELEASE_MANIFEST` e `RELEASES_URL` definem o canal de distribuição. Se mudar o provedor, ajuste também a validação de domínio e caminho do instalador.

A cópia de download não se sincroniza automaticamente com `../pagina-download/index.html`. Se alterar a página original, atualize esta cópia também.

O CSS incorporado foi gerado com a versão do Tailwind instalada no projeto. Ao adicionar classes utilitárias novas, regenere esse CSS. Os textos podem ser editados diretamente no HTML.
