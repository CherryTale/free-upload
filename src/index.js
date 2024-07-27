const { getInternalIP, getFreePort } = require('./utils.js');
const createThenStartServer = require('./server.js');

async function main(output) {
  try {
    const ip = getInternalIP();
    const port = await getFreePort(3000, 4000);
    return createThenStartServer(ip, port, output);
  } catch (err) {
    output.appendLine(err);
  }
}

module.exports = main;