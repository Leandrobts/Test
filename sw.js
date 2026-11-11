self.addEventListener('fetch', event => {
    // Intercepta a requisição que imita o load-and-stall.py
    if (event.request.url.includes('resources/load-and-stall.py')) {
        event.respondWith(
            new Response(
                new ReadableStream({
                    async start(controller) {
                        // Envia o primeiro pedaço (o navegador começa a carregar e fica em "loading")
                        const dummyHeader = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
                        controller.enqueue(dummyHeader);

                        // Trava/Stall por 30 segundos (tempo suficiente para o teste rodar)
                        await new Promise(resolve => setTimeout(resolve, 30000));

                        // Envia o resto e fecha a conexão
                        controller.close();
                    }
                }),
                {
                    headers: { 'Content-Type': 'application/octet-stream' }
                }
            )
        );
    }
});
