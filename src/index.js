const { getInternalIP, getFreePort } = require('./utils.js');
const createThenStartServer = require('./server.js');
const path = require('path');
const os = require('os');
//const chalk = require('chalk');

function main() {
  try {
    const ip = getInternalIP();
    const uploadURL = '/upload';
    const uploadDir = path.join(os.homedir(), 'uploads');
    getFreePort(start = 3000, end = 4000).then(port => {
      createThenStartServer(ip, port, uploadURL, uploadDir);
    })
  } catch (err) {
    //console.error(chalk.red(err));
    console.error(err);
  }
}

//if (require.main === module) {
//main();
//}

module.exports = main;