const vscode = require('vscode');
const main = require('./src/index');

function getWebviewContent(url) {
	return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Webview</title>
        </head>
        <body style="padding:0">
            <iframe src="${url}" style="width:100vw;height:100vh;border:none;"></iframe>
        </body>
        </html>
    `;
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	const output = vscode.window.createOutputChannel('Upload', { log: true });
	const myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);

	myStatusBarItem.text = '$(cloud-upload) Start';
	myStatusBarItem.tooltip = 'Start Upload Server';
	myStatusBarItem.command = 'free-upload.uploadStart';
	myStatusBarItem.show();

	let stopServer;
	let url;
	let panel;
	const startCmd = vscode.commands.registerCommand('free-upload.uploadStart', async function () {
		output.show();
		if (global.uploadServer !== "defined") {
			global.uploadServer = "defined";

			const result = await main(output);
			stopServer = result.stopServer;
			url = result.url;
			myStatusBarItem.text = '$(cloud) Stop';
			myStatusBarItem.tooltip = 'Stop Upload Server';
			myStatusBarItem.command = 'free-upload.uploadStop';
			myStatusBarItem.show();
		}
		panel = vscode.window.createWebviewPanel(
			'myWebview', // 识别 Webview 的内置 ID
			'LazPay Efficent Tools', // Webview 的标题
			vscode.ViewColumn.One, // 将 Webview 放在第一个竖列
			{ enableScripts: true } // Webview 的选项
		);
		panel.webview.html = getWebviewContent(url);
	});

	const stopCmd = vscode.commands.registerCommand('free-upload.uploadStop', function () {
		global.uploadServer = undefined;
		if (stopServer) {
			stopServer();
		}
		myStatusBarItem.text = '$(cloud-upload) Start';
		myStatusBarItem.tooltip = 'Start Upload Server';
		myStatusBarItem.command = 'free-upload.uploadStart';
		myStatusBarItem.show();
		panel?.dispose();
		panel = undefined;
	});

	context.subscriptions.push(myStatusBarItem);
	context.subscriptions.push(startCmd);
	context.subscriptions.push(stopCmd);
}

function deactivate() {
	vscode.commands.executeCommand('free-upload.uploadStop')
}

module.exports = {
	activate,
	deactivate
}
