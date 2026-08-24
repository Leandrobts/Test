<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>ServiceWorker FetchResponse cancellation test</title>

<style>
body {
    font-family: Arial, sans-serif;
    margin: 20px;
}

button {
    font-size: 18px;
    padding: 10px;
    margin-bottom: 15px;
}

#log {
    white-space: pre-wrap;
    font-family: monospace;
    border: 1px solid #999;
    padding: 10px;
    height: 400px;
    overflow: auto;
}
</style>
</head>

<body>

<h2>ServiceWorkerFetch cancellation test</h2>

<button onclick="startTest()">Start test</button>

<div id="log"></div>

<script>

var logElement = document.getElementById("log");
var running = false;
var iteration = 0;

function log(message) {
    var line = "[" + new Date().toLocaleTimeString() + "] " + message;

    console.log(line);

    logElement.textContent += line + "\n";
    logElement.scrollTop = logElement.scrollHeight;
}


function supportsRequiredFeatures() {

    if (!navigator.serviceWorker) {
        log("ERROR: Service Workers are not supported.");
        return false;
    }

    if (!window.fetch) {
        log("ERROR: fetch() is not supported.");
        return false;
    }

    if (!window.ReadableStream) {
        log("WARNING: ReadableStream is not exposed.");
    }

    return true;
}


function registerWorker(callback) {

    navigator.serviceWorker.register("sw.js")
        .then(function(registration) {

            log("Service Worker registered.");

            return navigator.serviceWorker.ready;

        })
        .then(function() {

            log("Service Worker ready.");

            if (navigator.serviceWorker.controller) {

                callback();

            } else {

                log("No controller yet. Reloading page.");

                window.location.reload();

            }

        })
        .catch(function(error) {

            log("Service Worker registration failed: " + error);

        });

}


function startTest() {

    if (running) {
        log("Test already running.");
        return;
    }

    if (!supportsRequiredFeatures())
        return;

    running = true;

    log("Starting ServiceWorker cancellation test.");

    registerWorker(function() {

        iteration = 0;

        runIteration();

    });

}


function runIteration() {

    if (!running)
        return;

    iteration++;

    var url =
        "stream-test?iteration=" +
        iteration +
        "&random=" +
        Math.random();

    log("Iteration " + iteration + ": fetch started.");

    var controller = null;

    if (window.AbortController)
        controller = new AbortController();

    var options = {};

    if (controller)
        options.signal = controller.signal;


    fetch(url, options)

        .then(function(response) {

            log(
                "Iteration " +
                iteration +
                ": response received. status=" +
                response.status
            );


            /*
             * Caminho 1:
             *
             * começa a consumir o body e logo
             * depois cancela a requisição.
             */

            if (controller) {

                setTimeout(function() {

                    log(
                        "Iteration " +
                        iteration +
                        ": AbortController.abort()"
                    );

                    try {
                        controller.abort();
                    } catch (e) {
                        log("Abort exception: " + e);
                    }

                }, 0);

            }


            /*
             * Caminho 2:
             *
             * tenta acessar diretamente o reader,
             * caso o browser suporte ReadableStream.
             */

            if (response.body &&
                response.body.getReader) {

                var reader = response.body.getReader();

                log(
                    "Iteration " +
                    iteration +
                    ": reader acquired."
                );


                reader.read()

                    .then(function(result) {

                        log(
                            "Iteration " +
                            iteration +
                            ": first chunk received. done=" +
                            result.done
                        );


                        setTimeout(function() {

                            log(
                                "Iteration " +
                                iteration +
                                ": reader.cancel()"
                            );

                            try {

                                reader.cancel(
                                    "cancel during stream consumption"
                                );

                            } catch (e) {

                                log(
                                    "reader.cancel exception: " +
                                    e
                                );

                            }

                        }, 0);

                    })

                    .catch(function(error) {

                        log(
                            "reader.read exception: " +
                            error
                        );

                    });

            } else {

                /*
                 * Fallback para WebKit mais antigo.
                 */

                log(
                    "ReadableStream reader unavailable."
                );

                try {

                    response.text();

                } catch (e) {

                    log(
                        "response.text exception: " +
                        e
                    );

                }

            }

        })

        .catch(function(error) {

            log(
                "Iteration " +
                iteration +
                ": fetch rejected: " +
                error
            );

        })

        .then(function() {

            /*
             * Continua criando ciclos de FetchResponse
             * + cancelamento.
             */

            if (iteration < 10000) {

                setTimeout(
                    runIteration,
                    1
                );

            } else {

                log("Test completed.");

                running = false;

            }

        });

}


/*
 * Opcional:
 * tentar registrar novamente caso o SW ainda
 * não esteja controlando a página.
 */

if (navigator.serviceWorker) {

    navigator.serviceWorker.addEventListener(
        "controllerchange",
        function() {

            log("Service Worker controller changed.");

        }
    );

}

</script>

</body>
</html>