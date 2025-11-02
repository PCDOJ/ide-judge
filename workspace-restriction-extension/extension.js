// @ts-check
const vscode = require('vscode');

/**
 * VSCode Extension để chặn việc mở folder khác ngoài workspace hiện tại
 * Ngăn chặn các command: workbench.action.files.openFolder, workbench.action.files.openFileFolder
 */

function activate(context) {
    console.log('[Workspace Restriction] Extension activated');

    // Danh sách các command cần chặn hoàn toàn
    const restrictedCommands = [
        // Folder opening commands
        'workbench.action.files.openFolder',
        'workbench.action.files.openFileFolder',
        'workbench.action.addRootFolder',
        'workbench.action.files.openFileFolderInNewWindow',
        'workbench.action.files.openFolderInNewWindow',
        'vscode.openFolder',
        
        // Terminal profile selection commands
        'workbench.action.terminal.selectDefaultProfile'
    ];

    // Override các command bị cấm
    restrictedCommands.forEach(commandId => {
        const disposable = vscode.commands.registerCommand(commandId, () => {
            vscode.window.showErrorMessage(
                '🔒 Restricted Mode: Opening other folders is not allowed. You can only work within the current workspace.',
                { modal: true }
            );
            console.log(`[Workspace Restriction] Blocked command: ${commandId}`);
            return; // Không thực hiện gì cả
        });
        context.subscriptions.push(disposable);
    });

    // Override terminal creation commands để luôn dùng restricted profile
    const terminalNewDisposable = vscode.commands.registerCommand('workbench.action.terminal.new', async () => {
        // Tạo terminal mới với restricted profile
        const terminal = vscode.window.createTerminal({
            name: 'Restricted Terminal',
            shellPath: '/usr/local/bin/restricted-bash-wrapper.sh',
            iconPath: new vscode.ThemeIcon('shield')
        });
        terminal.show();
        console.log('[Workspace Restriction] Created new restricted terminal');
    });
    context.subscriptions.push(terminalNewDisposable);

    // Chặn việc thay đổi workspace folders
    const workspaceFoldersChangeDisposable = vscode.workspace.onDidChangeWorkspaceFolders(event => {
        if (event.added.length > 0) {
            vscode.window.showWarningMessage(
                '⚠️ Warning: Adding workspace folders is restricted in this environment.',
                { modal: false }
            );
            console.log('[Workspace Restriction] Workspace folder change detected and warned');
        }
    });
    context.subscriptions.push(workspaceFoldersChangeDisposable);

    // Monitor terminal creation để đảm bảo chỉ dùng restricted shell
    const terminalOpenDisposable = vscode.window.onDidOpenTerminal(terminal => {
        console.log(`[Workspace Restriction] Terminal opened: ${terminal.name}`);
        // Log để tracking, không thể force change terminal đã tạo
    });
    context.subscriptions.push(terminalOpenDisposable);

    // Hiển thị thông báo khi extension được kích hoạt
    vscode.window.showInformationMessage(
        '🔒 Workspace Restriction Mode: Active',
        { modal: false }
    );

    console.log('[Workspace Restriction] All restricted commands have been overridden');
}

function deactivate() {
    console.log('[Workspace Restriction] Extension deactivated');
}

module.exports = {
    activate,
    deactivate
};

