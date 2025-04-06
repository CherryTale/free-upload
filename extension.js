import * as vscode from 'vscode';
import createThenStartServer from '@server/index';

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
	const startCmd = vscode.commands.registerCommand('free-upload.uploadStart', async () => {
		output.show();
		if (global.uploadServer !== "defined") {
			global.uploadServer = "defined";

			const result = await createThenStartServer(output);
			stopServer = result.stopServer;
			myStatusBarItem.text = '$(cloud) Stop';
			myStatusBarItem.tooltip = 'Stop Upload Server';
			myStatusBarItem.command = 'free-upload.uploadStop';
			myStatusBarItem.show();
		}
	});

	const stopCmd = vscode.commands.registerCommand('free-upload.uploadStop', () => {
		global.uploadServer = undefined;
		if (stopServer) {
			stopServer();
		}
		myStatusBarItem.text = '$(cloud-upload) Start';
		myStatusBarItem.tooltip = 'Start Upload Server';
		myStatusBarItem.command = 'free-upload.uploadStart';
		myStatusBarItem.show();
	});

	context.subscriptions.push(myStatusBarItem);
	context.subscriptions.push(startCmd);
	context.subscriptions.push(stopCmd);
}

function deactivate() {
	vscode.commands.executeCommand('free-upload.uploadStop')
}

export {
	activate,
	deactivate
}
