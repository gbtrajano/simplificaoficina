# Demonstração horizontal — Simplifica Oficina

Vídeo de 45 segundos, 1920 × 1080, sem áudio, com títulos, transições e destaques. Exportação MP4/H.264 feita com Canvas + MediaRecorder do Edge.

As capturas usam os próprios componentes React do aplicativo e dados fictícios em memória. O harness não monta login/licença e bloqueia todas as operações da API, exceto as leituras substituídas por dados de demonstração. Nenhuma credencial, conta real ou banco SQLite é necessário. Não distribuir este harness como aplicativo: é exclusivamente um recurso local de produção do vídeo.

## Arquivos para publicar

- `../landing-page/video-sistema.mp4`
- `../landing-page/video-poster.jpg`
- `../landing-page/video-legendas.vtt`
- `../landing-page/index.html` atualizado com player e transcrição.

## Reprodução da produção local

1. Execute o Vite do projeto em localhost na porta 1428.
2. Abra uma instância de teste isolada do Edge com depuração local na porta 9327.
3. Execute `bun video-source/capture.mjs` para gerar capturas das telas com dados fictícios.
4. Execute `bun video-source/export.mjs` para compor e exportar o MP4 (tempo real).

`render.js` contém o roteiro, os tempos e a composição. `frames/` contém as capturas intermediárias. A fonte Manrope usa Google Fonts, com fallback local sans-serif.

O vídeo não contém preço de assinatura, narração, música ou promessa de resultados. Os valores presentes nas telas são exemplos operacionais fictícios.
