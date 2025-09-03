import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

interface CheckpointMetadata {
    timestamp: string;
    description: string;
    fileCount: number;
}

interface CheckpointsData {
    [name: string]: CheckpointMetadata;
}

export function activate(context: vscode.ExtensionContext) {
    console.log('Checkpoints extension is now active!');

    // Set context for when extension is enabled
    vscode.commands.executeCommand('setContext', 'checkpoints.enabled', true);

    // Register all commands
    const commands = [
        vscode.commands.registerCommand('checkpoints.save', saveCheckpoint),
        vscode.commands.registerCommand('checkpoints.saveQuick', saveQuickCheckpoint),
        vscode.commands.registerCommand('checkpoints.list', listCheckpoints),
        vscode.commands.registerCommand('checkpoints.restore', restoreCheckpoint),
        vscode.commands.registerCommand('checkpoints.check', checkCodeQuality),
        vscode.commands.registerCommand('checkpoints.clean', cleanCheckpoints)
    ];

    // Create status bar item
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.text = "$(save-all) Checkpoint";
    statusBarItem.tooltip = "Quick checkpoint (Cmd+Shift+S)";
    statusBarItem.command = 'checkpoints.saveQuick';
    statusBarItem.show();

    // Add all to context
    context.subscriptions.push(...commands, statusBarItem);

    // Show welcome message on first activation
    if (!context.globalState.get('checkpoints.welcomed')) {
        vscode.window.showInformationMessage(
            'Checkpoints extension activated! Use Cmd+Shift+S for quick checkpoints.',
            'Learn More'
        ).then(selection => {
            if (selection === 'Learn More') {
                vscode.commands.executeCommand('checkpoints.list');
            }
        });
        context.globalState.update('checkpoints.welcomed', true);
    }
}

class CheckpointManager {
    private workspaceRoot: string;
    private checkpointDir: string;
    private metadataFile: string;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        this.checkpointDir = path.join(workspaceRoot, '.checkpoints');
        this.metadataFile = path.join(this.checkpointDir, 'metadata.json');
        this.ensureCheckpointDir();
    }

    private ensureCheckpointDir(): void {
        if (!fs.existsSync(this.checkpointDir)) {
            fs.mkdirSync(this.checkpointDir, { recursive: true });
        }
    }

    private loadMetadata(): CheckpointsData {
        if (!fs.existsSync(this.metadataFile)) {
            return {};
        }
        try {
            const content = fs.readFileSync(this.metadataFile, 'utf8');
            return JSON.parse(content);
        } catch {
            return {};
        }
    }

    private saveMetadata(metadata: CheckpointsData): void {
        fs.writeFileSync(this.metadataFile, JSON.stringify(metadata, null, 2));
    }

    private copyDirectory(src: string, dest: string, excludePatterns: string[] = ['.checkpoints', '.git', 'node_modules', '__pycache__']): number {
        let fileCount = 0;
        
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }

        const items = fs.readdirSync(src);
        
        for (const item of items) {
            if (excludePatterns.includes(item)) {continue;}
            
            const srcPath = path.join(src, item);
            const destPath = path.join(dest, item);
            const stat = fs.statSync(srcPath);
            
            if (stat.isDirectory()) {
                fileCount += this.copyDirectory(srcPath, destPath, excludePatterns);
            } else {
                fs.copyFileSync(srcPath, destPath);
                fileCount++;
            }
        }
        
        return fileCount;
    }

    private removeDirectory(dirPath: string): void {
        if (!fs.existsSync(dirPath)) {return;}
        
        const items = fs.readdirSync(dirPath);
        for (const item of items) {
            const itemPath = path.join(dirPath, item);
            const stat = fs.statSync(itemPath);
            
            if (stat.isDirectory()) {
                this.removeDirectory(itemPath);
            } else {
                fs.unlinkSync(itemPath);
            }
        }
        fs.rmdirSync(dirPath);
    }

    saveCheckpoint(name: string, description: string): boolean {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const checkpointPath = path.join(this.checkpointDir, name);
            
            // Remove existing checkpoint if it exists
            if (fs.existsSync(checkpointPath)) {
                this.removeDirectory(checkpointPath);
            }
            
            // Copy current state
            const fileCount = this.copyDirectory(this.workspaceRoot, checkpointPath);
            
            // Update metadata
            const metadata = this.loadMetadata();
            metadata[name] = {
                timestamp,
                description,
                fileCount
            };
            this.saveMetadata(metadata);
            
            return true;
        } catch (error) {
            console.error('Error saving checkpoint:', error);
            return false;
        }
    }

    listCheckpoints(): CheckpointsData {
        return this.loadMetadata();
    }

    restoreCheckpoint(name: string): boolean {
        try {
            const checkpointPath = path.join(this.checkpointDir, name);
            
            if (!fs.existsSync(checkpointPath)) {
                return false;
            }
            
            // Create auto-backup before restore
            const backupName = `auto_backup_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}`;
            this.saveCheckpoint(backupName, 'Auto-backup before restore');
            
            // Clear current files (except .checkpoints and .git)
            const items = fs.readdirSync(this.workspaceRoot);
            for (const item of items) {
                if (item === '.checkpoints' || item === '.git') {continue;}
                
                const itemPath = path.join(this.workspaceRoot, item);
                const stat = fs.statSync(itemPath);
                
                if (stat.isDirectory()) {
                    this.removeDirectory(itemPath);
                } else {
                    fs.unlinkSync(itemPath);
                }
            }
            
            // Restore from checkpoint
            this.copyDirectory(checkpointPath, this.workspaceRoot, []);
            
            return true;
        } catch (error) {
            console.error('Error restoring checkpoint:', error);
            return false;
        }
    }

    deleteCheckpoint(name: string): boolean {
        try {
            const checkpointPath = path.join(this.checkpointDir, name);
            
            if (!fs.existsSync(checkpointPath)) {
                return false;
            }
            
            this.removeDirectory(checkpointPath);
            
            const metadata = this.loadMetadata();
            delete metadata[name];
            this.saveMetadata(metadata);
            
            return true;
        } catch (error) {
            console.error('Error deleting checkpoint:', error);
            return false;
        }
    }

    cleanOldCheckpoints(days: number): number {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        
        const metadata = this.loadMetadata();
        let deletedCount = 0;
        
        for (const [name, info] of Object.entries(metadata)) {
            const checkpointTime = new Date(info.timestamp);
            if (checkpointTime < cutoff && !name.startsWith('auto_backup')) {
                if (this.deleteCheckpoint(name)) {
                    deletedCount++;
                }
            }
        }
        
        return deletedCount;
    }
}

async function getWorkspaceRoot(): Promise<string | undefined> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('No workspace folder found');
        return undefined;
    }
    return workspaceFolders[0].uri.fsPath;
}

async function getCheckpointManager(): Promise<CheckpointManager | undefined> {
    const workspaceRoot = await getWorkspaceRoot();
    if (!workspaceRoot) {return undefined;}
    return new CheckpointManager(workspaceRoot);
}

async function saveCheckpoint() {
    const name = await vscode.window.showInputBox({
        prompt: 'Enter checkpoint name',
        placeHolder: 'e.g., working_auth_module'
    });

    if (!name) {return;}

    const description = await vscode.window.showInputBox({
        prompt: 'Enter checkpoint description (optional)',
        placeHolder: 'e.g., Authentication module working correctly'
    });

    const manager = await getCheckpointManager();
    if (!manager) {return;}

    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Creating checkpoint "${name}"...`,
            cancellable: false
        }, async () => {
            const success = manager.saveCheckpoint(name, description || '');
            
            if (success) {
                vscode.window.showInformationMessage(`✅ Checkpoint "${name}" created successfully!`);
            } else {
                vscode.window.showErrorMessage(`Failed to create checkpoint "${name}"`);
            }
        });
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to create checkpoint: ${error}`);
    }
}

async function saveQuickCheckpoint() {
    const manager = await getCheckpointManager();
    if (!manager) {return;}

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const name = `quick_${timestamp}`;

    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Creating quick checkpoint...',
            cancellable: false
        }, async () => {
            const success = manager.saveCheckpoint(name, 'Quick checkpoint');
            
            if (success) {
                vscode.window.showInformationMessage(`✅ Quick checkpoint created: ${name}`);
            } else {
                vscode.window.showErrorMessage(`Failed to create quick checkpoint`);
            }
        });
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to create quick checkpoint: ${error}`);
    }
}

async function listCheckpoints() {
    const manager = await getCheckpointManager();
    if (!manager) {return;}

    try {
        const checkpoints = manager.listCheckpoints();
        
        if (Object.keys(checkpoints).length === 0) {
            vscode.window.showInformationMessage('No checkpoints found');
            return;
        }

        // Format the checkpoint list
        let content = '📋 Available Checkpoints:\n';
        content += '-'.repeat(50) + '\n';
        
        for (const [name, info] of Object.entries(checkpoints).sort((a, b) => a[1].timestamp.localeCompare(b[1].timestamp))) {
            content += `🔖 ${name}\n`;
            content += `   📅 ${info.timestamp}\n`;
            content += `   📝 ${info.description || 'No description'}\n`;
            content += `   📁 ${info.fileCount} files\n\n`;
        }
        
        // Create a new document to show the checkpoint list
        const doc = await vscode.workspace.openTextDocument({
            content,
            language: 'plaintext'
        });
        await vscode.window.showTextDocument(doc);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to list checkpoints: ${error}`);
    }
}

async function restoreCheckpoint() {
    const manager = await getCheckpointManager();
    if (!manager) {return;}

    try {
        const checkpoints = manager.listCheckpoints();
        const checkpointNames = Object.keys(checkpoints);

        if (checkpointNames.length === 0) {
            vscode.window.showInformationMessage('No checkpoints found');
            return;
        }

        // Create quick pick items with descriptions
        const quickPickItems = checkpointNames.map(name => ({
            label: name,
            description: checkpoints[name].description,
            detail: `📅 ${checkpoints[name].timestamp} • 📁 ${checkpoints[name].fileCount} files`
        }));

        const selected = await vscode.window.showQuickPick(quickPickItems, {
            placeHolder: 'Select checkpoint to restore'
        });

        if (!selected) {return;}

        // Confirm restoration
        const confirm = await vscode.window.showWarningMessage(
            `Are you sure you want to restore "${selected.label}"? This will overwrite your current code.`,
            { modal: true },
            'Yes, Restore'
        );

        if (confirm === 'Yes, Restore') {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Restoring checkpoint "${selected.label}"...`,
                cancellable: false
            }, async () => {
                const success = manager.restoreCheckpoint(selected.label);
                
                if (success) {
                    vscode.window.showInformationMessage(`✅ Restored from checkpoint "${selected.label}"`);
                    
                    // Reload the workspace
                    vscode.commands.executeCommand('workbench.action.reloadWindow');
                } else {
                    vscode.window.showErrorMessage(`Failed to restore checkpoint "${selected.label}"`);
                }
            });
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to restore checkpoint: ${error}`);
    }
}

async function checkCodeQuality() {
    vscode.window.showInformationMessage('✅ Code quality check feature is available. This extension works independently of quality gates!');
}

async function cleanCheckpoints() {
    const days = await vscode.window.showInputBox({
        prompt: 'Delete checkpoints older than how many days?',
        value: '7',
        validateInput: (value) => {
            const num = parseInt(value);
            if (isNaN(num) || num < 1) {
                return 'Please enter a valid number of days';
            }
            return null;
        }
    });

    if (!days) {return;}

    const manager = await getCheckpointManager();
    if (!manager) {return;}

    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Cleaning checkpoints older than ${days} days...`,
            cancellable: false
        }, async () => {
            const deletedCount = manager.cleanOldCheckpoints(parseInt(days));
            vscode.window.showInformationMessage(`🧹 Cleaned ${deletedCount} old checkpoints`);
        });
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to clean checkpoints: ${error}`);
    }
}

export function deactivate() {
    vscode.commands.executeCommand('setContext', 'checkpoints.enabled', false);
}
