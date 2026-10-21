onmessage = () => {
  postMessage(undefined)
}
new Worker('service-workers.js');
