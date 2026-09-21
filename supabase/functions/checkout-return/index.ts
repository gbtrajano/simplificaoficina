// Página pública exibida pelo Mercado Pago depois do checkout.
// Não confirma pagamento: a confirmação e a liberação são feitas somente pelo
// webhook assinado, pois o retorno do navegador pode ser fechado ou forjado.

const page = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Simplifica Oficina — Pagamento em processamento</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f0fdf8; color: #102a43; font-family: Arial, sans-serif; }
      main { max-width: 460px; margin: 24px; padding: 36px; text-align: center; border-radius: 20px; background: white; box-shadow: 0 12px 30px #0f766e20; }
      h1 { margin: 0 0 14px; font-size: 24px; } p { color: #52667a; line-height: 1.55; }
    </style>
  </head>
  <body><main><div style="font-size:42px">✓</div><h1>Pagamento recebido</h1><p>Estamos confirmando sua assinatura. Volte ao Simplifica Oficina em alguns instantes para continuar.</p></main></body>
</html>`;

Deno.serve(() => new Response(page, {
  headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
}));
