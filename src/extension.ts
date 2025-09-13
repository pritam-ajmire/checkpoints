import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

interface CheckpointMetadata {
    timestamp: string;
    description: string;
    fileCount: number;
    isIncremental?: boolean;
    baseCheckpoint?: string;
    changedFiles?: string[];
    totalSize?: number;
    incrementalSize?: number;
}

interface FileInfo {
    path: string;
    size: number;
    mtime: number;
    hash: string;
}

interface CheckpointsData {
    [name: string]: CheckpointMetadata;
}

class CheckpointItem {
    constructor(
        public readonly name: string,
        public readonly metadata: CheckpointMetadata,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None
    ) {}

    get tooltip(): string {
        let tooltip = `${this.name} - ${this.metadata.description || 'No description'}`;
        
        if (this.metadata.isIncremental) {
            tooltip += `\n📊 Incremental checkpoint (${this.metadata.changedFiles?.length || 0} changed files)`;
            tooltip += `\n🔗 Based on: ${this.metadata.baseCheckpoint}`;
            if (this.metadata.incrementalSize) {
                tooltip += `\n💾 Size: ${this.formatBytes(this.metadata.incrementalSize)}`;
            }
        } else {
            if (this.metadata.totalSize) {
                tooltip += `\n💾 Size: ${this.formatBytes(this.metadata.totalSize)}`;
            }
        }
        
        return tooltip;
    }

    get description(): string {
        let description = this.metadata.description || 'No description';
        
        if (this.metadata.isIncremental) {
            description += ` (${this.metadata.changedFiles?.length || 0} changes)`;
        }
        
        return description;
    }

    private formatBytes(bytes: number): string {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    get iconPath(): vscode.ThemeIcon {
        return new vscode.ThemeIcon(this.metadata.isIncremental ? 'diff-added' : 'save');
    }

    get contextValue(): string {
        return 'checkpoint';
    }
}

class CheckpointsProvider implements vscode.TreeDataProvider<CheckpointItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<CheckpointItem | undefined | null | void> = new vscode.EventEmitter<CheckpointItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<CheckpointItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private manager: CheckpointManager | undefined;

    constructor() {
        this.initializeManager();
    }

    private async initializeManager(): Promise<void> {
        const workspaceRoot = await getWorkspaceRoot();
        if (workspaceRoot) {
            this.manager = new CheckpointManager(workspaceRoot);
        }
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: CheckpointItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: CheckpointItem): Promise<CheckpointItem[]> {
        if (!this.manager) {
            await this.initializeManager();
        }

        if (!this.manager) {
            return [];
        }

        if (!element) {
            // Return root level items (all checkpoints)
            const checkpoints = this.manager.listCheckpoints();
            return Object.entries(checkpoints)
                .sort((a, b) => b[1].timestamp.localeCompare(a[1].timestamp)) // Sort by newest first
                .map(([name, metadata]) => new CheckpointItem(name, metadata));
        }

        return [];
    }
}

// Global provider instance
let checkpointsProvider: CheckpointsProvider;

export function activate(context: vscode.ExtensionContext) {
    console.log('Checkpoints extension is now active!');

    // Set context for when extension is enabled
    vscode.commands.executeCommand('setContext', 'checkpoints.enabled', true);

    // Create the checkpoints provider
    checkpointsProvider = new CheckpointsProvider();

    // Register the tree data provider
    const treeView = vscode.window.createTreeView('checkpointsView', {
        treeDataProvider: checkpointsProvider
    });

    // Register all commands
    const commands = [
        vscode.commands.registerCommand('checkpoints.save', saveCheckpoint),
        vscode.commands.registerCommand('checkpoints.saveFull', saveFullCheckpoint),
        vscode.commands.registerCommand('checkpoints.saveQuick', saveQuickCheckpoint),
        vscode.commands.registerCommand('checkpoints.list', listCheckpoints),
        vscode.commands.registerCommand('checkpoints.restore', restoreCheckpoint),
        vscode.commands.registerCommand('checkpoints.check', checkCodeQuality),
        vscode.commands.registerCommand('checkpoints.clean', cleanCheckpoints),
        vscode.commands.registerCommand('checkpoints.refresh', () => checkpointsProvider.refresh()),
        vscode.commands.registerCommand('checkpoints.restoreFromTree', async (item: CheckpointItem) => {
            await restoreCheckpointFromTree(item);
        }),
        vscode.commands.registerCommand('checkpoints.deleteFromTree', async (item: CheckpointItem) => {
            await deleteCheckpointFromTree(item);
        }),
        vscode.commands.registerCommand('checkpoints.viewFiles', async (item: CheckpointItem) => {
            await viewCheckpointFiles(item);
        }),
        vscode.commands.registerCommand('checkpoints.deleteAll', async () => {
            await deleteAllCheckpoints();
        })
    ];

    // Create status bar item
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.text = "$(save-all) Checkpoint";
    statusBarItem.tooltip = "Quick checkpoint (Cmd+Shift+S)";
    statusBarItem.command = 'checkpoints.saveQuick';
    statusBarItem.show();
    

    // Add all to context
    context.subscriptions.push(...commands, statusBarItem, treeView);

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

    private getFileInfo(filePath: string): FileInfo | null {
        try {
            const stat = fs.statSync(filePath);
            return {
                path: filePath,
                size: stat.size,
                mtime: stat.mtime.getTime(),
                hash: this.calculateFileHash(filePath)
            };
        } catch {
            return null;
        }
    }

    private calculateFileHash(filePath: string): string {
        try {
            const content = fs.readFileSync(filePath);
            return crypto.createHash('md5').update(content).digest('hex');
        } catch {
            return '';
        }
    }

    private getChangedFiles(baseCheckpointPath: string): string[] {
        const changedFiles: string[] = [];
        const baseFiles = this.getFileList(baseCheckpointPath);
        const currentFiles = this.getFileList(this.workspaceRoot);

        console.log(`[DEBUG] Base checkpoint path: ${baseCheckpointPath}`);
        console.log(`[DEBUG] Base files count: ${baseFiles.size}`);
        console.log(`[DEBUG] Current files count: ${currentFiles.size}`);
        console.log(`[DEBUG] Base files:`, Array.from(baseFiles.keys()));
        console.log(`[DEBUG] Current files:`, Array.from(currentFiles.keys()));

        // Check for new or modified files
        for (const [relativePath, currentInfo] of currentFiles) {
            const baseInfo = baseFiles.get(relativePath);
            
            if (!baseInfo) {
                console.log(`[DEBUG] New file: ${relativePath}`);
                changedFiles.push(relativePath);
            } else {
                // Check if file actually changed by comparing hash first (most reliable)
                const hashChanged = currentInfo.hash !== baseInfo.hash;
                const sizeChanged = currentInfo.size !== baseInfo.size;
                
                // Only consider it changed if hash or size changed (ignore mtime alone)
                if (hashChanged || sizeChanged) {
                    console.log(`[DEBUG] Modified file: ${relativePath} (hash: ${hashChanged ? 'changed' : 'same'}, size: ${currentInfo.size} vs ${baseInfo.size})`);
                    changedFiles.push(relativePath);
                }
            }
        }

        console.log(`[DEBUG] Changed files: ${changedFiles.length}`, changedFiles);
        return changedFiles;
    }

    private getFileList(dirPath: string, relativePath: string = ''): Map<string, FileInfo> {
        const files = new Map<string, FileInfo>();
        const excludePatterns = ['.checkpoints', '.git', 'node_modules', '__pycache__', '.vscode'];

        try {
            const items = fs.readdirSync(dirPath);
            
            for (const item of items) {
                if (excludePatterns.includes(item)) continue;
                
                const fullPath = path.join(dirPath, item);
                const itemRelativePath = relativePath ? path.join(relativePath, item) : item;
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory()) {
                    const subFiles = this.getFileList(fullPath, itemRelativePath);
                    for (const [subPath, subInfo] of subFiles) {
                        files.set(subPath, subInfo);
                    }
                } else {
                    const fileInfo = this.getFileInfo(fullPath);
                    if (fileInfo) {
                        // Normalize the relative path to use forward slashes for consistency
                        const normalizedPath = itemRelativePath.replace(/\\/g, '/');
                        files.set(normalizedPath, fileInfo);
                    }
                }
            }
        } catch (error) {
            console.error('Error reading directory:', error);
        }

        return files;
    }

    private copyIncrementalFiles(changedFiles: string[], baseCheckpointPath: string, newCheckpointPath: string): number {
        let fileCount = 0;
        
        for (const relativePath of changedFiles) {
            // Convert normalized path back to system path
            const systemPath = relativePath.replace(/\//g, path.sep);
            const srcPath = path.join(this.workspaceRoot, systemPath);
            const destPath = path.join(newCheckpointPath, systemPath);
            
            try {
                // Ensure destination directory exists
                const destDir = path.dirname(destPath);
                if (!fs.existsSync(destDir)) {
                    fs.mkdirSync(destDir, { recursive: true });
                }
                
                // Copy the file
                fs.copyFileSync(srcPath, destPath);
                fileCount++;
                console.log(`[DEBUG] Copied file: ${systemPath}`);
            } catch (error) {
                console.error(`Error copying file ${systemPath}:`, error);
            }
        }
        
        return fileCount;
    }

    private getLastCheckpoint(): string | null {
        const metadata = this.loadMetadata();
        const checkpoints = Object.entries(metadata)
            .filter(([, meta]) => !meta.isIncremental)
            .sort((a, b) => b[1].timestamp.localeCompare(a[1].timestamp));
        
        return checkpoints.length > 0 ? checkpoints[0][0] : null;
    }

    private copyDirectory(src: string, dest: string, excludePatterns: string[] = ['.checkpoints', '.git', 'node_modules', '__pycache__']): number {
        let fileCount = 0;
        
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }

        const items = fs.readdirSync(src);
        
        for (const item of items) {
            if (excludePatterns.includes(item)) {
            continue;
        }
            
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
        
        try {
            // Use fs.rmSync with recursive option for better reliability
            fs.rmSync(dirPath, { recursive: true, force: true });
        } catch (error) {
            console.error(`Error removing directory ${dirPath}:`, error);
            // Fallback to manual removal
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
            try {
                fs.rmdirSync(dirPath);
            } catch (rmError) {
                console.error(`Error removing directory ${dirPath}:`, rmError);
            }
        }
    }

    saveCheckpoint(name: string, description: string, forceFull: boolean = false): boolean {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const checkpointPath = path.join(this.checkpointDir, name);
            
            // Remove existing checkpoint if it exists
            if (fs.existsSync(checkpointPath)) {
                this.removeDirectory(checkpointPath);
            }
            
            let fileCount = 0;
            let isIncremental = false;
            let baseCheckpoint: string | undefined;
            let changedFiles: string[] = [];
            let totalSize = 0;
            let incrementalSize = 0;
            
            // Check if we can create an incremental checkpoint
            if (!forceFull) {
                const lastCheckpoint = this.getLastCheckpoint();
                console.log(`[DEBUG] Last checkpoint: ${lastCheckpoint}`);
                
                if (lastCheckpoint) {
                    const baseCheckpointPath = path.join(this.checkpointDir, lastCheckpoint);
                    console.log(`[DEBUG] Base checkpoint path: ${baseCheckpointPath}`);
                    console.log(`[DEBUG] Base checkpoint exists: ${fs.existsSync(baseCheckpointPath)}`);
                    
                    if (fs.existsSync(baseCheckpointPath)) {
                        changedFiles = this.getChangedFiles(baseCheckpointPath);
                        
                        console.log(`[DEBUG] Changed files count: ${changedFiles.length}`);
                        console.log(`[DEBUG] Threshold check: ${changedFiles.length > 0 && changedFiles.length < 100}`);
                        
                        // Only create incremental if there are changes and it's worth it
                        if (changedFiles.length > 0 && changedFiles.length < 100) { // Threshold for incremental
                            console.log(`[DEBUG] Creating incremental checkpoint`);
                            isIncremental = true;
                            baseCheckpoint = lastCheckpoint;
                            
                            // Copy only changed files
                            fileCount = this.copyIncrementalFiles(changedFiles, baseCheckpointPath, checkpointPath);
                            
                            // Calculate sizes
                            incrementalSize = this.calculateDirectorySize(checkpointPath);
                            totalSize = this.calculateDirectorySize(baseCheckpointPath) + incrementalSize;
                        } else {
                            console.log(`[DEBUG] Not creating incremental: changedFiles=${changedFiles.length}, threshold=${changedFiles.length < 100}`);
                        }
                    }
                } else {
                    console.log(`[DEBUG] No last checkpoint found`);
                }
            } else {
                console.log(`[DEBUG] Force full checkpoint`);
            }
            
            // If not incremental or incremental failed, do full copy
            if (!isIncremental) {
                fileCount = this.copyDirectory(this.workspaceRoot, checkpointPath);
                totalSize = this.calculateDirectorySize(checkpointPath);
                incrementalSize = totalSize;
            }
            
            // Update metadata
            const metadata = this.loadMetadata();
            metadata[name] = {
                timestamp,
                description,
                fileCount,
                isIncremental,
                baseCheckpoint,
                changedFiles: isIncremental ? changedFiles : undefined,
                totalSize,
                incrementalSize
            };
            this.saveMetadata(metadata);
            
            return true;
        } catch (error) {
            console.error('Error saving checkpoint:', error);
            return false;
        }
    }

    private calculateDirectorySize(dirPath: string): number {
        let totalSize = 0;
        
        try {
            const items = fs.readdirSync(dirPath);
            for (const item of items) {
                const itemPath = path.join(dirPath, item);
                const stat = fs.statSync(itemPath);
                
                if (stat.isDirectory()) {
                    totalSize += this.calculateDirectorySize(itemPath);
                } else {
                    totalSize += stat.size;
                }
            }
        } catch (error) {
            console.error('Error calculating directory size:', error);
        }
        
        return totalSize;
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
            
            // Get checkpoint metadata
            const metadata = this.loadMetadata();
            const checkpointMeta = metadata[name];
            
            if (checkpointMeta?.isIncremental && checkpointMeta.baseCheckpoint) {
                // Restore incremental checkpoint
                return this.restoreIncrementalCheckpoint(name, checkpointMeta);
            } else {
                // Restore full checkpoint
                return this.restoreFullCheckpoint(checkpointPath);
            }
        } catch (error) {
            console.error('Error restoring checkpoint:', error);
            return false;
        }
    }

    private restoreIncrementalCheckpoint(name: string, metadata: CheckpointMetadata): boolean {
        try {
            if (!metadata.baseCheckpoint || !metadata.changedFiles) {
                return false;
            }
            
            const baseCheckpointPath = path.join(this.checkpointDir, metadata.baseCheckpoint);
            if (!fs.existsSync(baseCheckpointPath)) {
                console.error('Base checkpoint not found:', metadata.baseCheckpoint);
                return false;
            }
            
            // First restore the base checkpoint
            if (!this.restoreFullCheckpoint(baseCheckpointPath)) {
                return false;
            }
            
            // Then apply the incremental changes
            const incrementalPath = path.join(this.checkpointDir, name);
            for (const relativePath of metadata.changedFiles) {
                const srcPath = path.join(incrementalPath, relativePath);
                const destPath = path.join(this.workspaceRoot, relativePath);
                
                if (fs.existsSync(srcPath)) {
                    // Ensure destination directory exists
                    const destDir = path.dirname(destPath);
                    if (!fs.existsSync(destDir)) {
                        fs.mkdirSync(destDir, { recursive: true });
                    }
                    
                    // Copy the file
                    fs.copyFileSync(srcPath, destPath);
                }
            }
            
            return true;
        } catch (error) {
            console.error('Error restoring incremental checkpoint:', error);
            return false;
        }
    }

    private restoreFullCheckpoint(checkpointPath: string): boolean {
        try {
            // Clear current files (except .checkpoints and .git)
            const items = fs.readdirSync(this.workspaceRoot);
            for (const item of items) {
                if (item === '.checkpoints' || item === '.git') {
                    continue;
                }
                
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
            console.error('Error restoring full checkpoint:', error);
            return false;
        }
    }

    deleteCheckpoint(name: string): boolean {
        try {
            const checkpointPath = path.join(this.checkpointDir, name);
            console.log(`[DEBUG] Attempting to delete checkpoint: ${name} at ${checkpointPath}`);
              
            if (!fs.existsSync(checkpointPath)) {
                console.log(`[DEBUG] Checkpoint directory does not exist: ${checkpointPath}`);
                return false;
            }
            
            console.log(`[DEBUG] Removing checkpoint directory: ${checkpointPath}`);
            this.removeDirectory(checkpointPath);
            
            // Verify directory was removed
            if (fs.existsSync(checkpointPath)) {
                console.error(`[DEBUG] Failed to remove checkpoint directory: ${checkpointPath}`);
                return false;
            }
            
            const metadata = this.loadMetadata();
            delete metadata[name];
            this.saveMetadata(metadata);
            
            console.log(`[DEBUG] Successfully deleted checkpoint: ${name}`);
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
                showAutoHideMessage(`✅ Checkpoint "${name}" created successfully!`);
                checkpointsProvider.refresh();
            } else {
                vscode.window.showErrorMessage(`Failed to create checkpoint "${name}"`);
            }
        });
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to create checkpoint: ${error}`);
    }
}

async function saveFullCheckpoint() {
    const name = await vscode.window.showInputBox({
        prompt: 'Enter checkpoint name (Full checkpoint)',
        placeHolder: 'e.g., major_refactor_complete'
    });

    if (!name) {return;}

    const description = await vscode.window.showInputBox({
        prompt: 'Enter checkpoint description (optional)',
        placeHolder: 'e.g., Complete refactor of authentication system'
    });

    const manager = await getCheckpointManager();
    if (!manager) {return;}

    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Creating full checkpoint "${name}"...`,
            cancellable: false
        }, async () => {
            const success = manager.saveCheckpoint(name, description || '', true); // Force full checkpoint
            
            if (success) {
                showAutoHideMessage(`✅ Full checkpoint "${name}" created successfully!`);
                checkpointsProvider.refresh();
            } else {
                vscode.window.showErrorMessage(`Failed to create full checkpoint "${name}"`);
            }
        });
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to create full checkpoint: ${error}`);
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
                showAutoHideMessage(`✅ Checkpoint created: ${name}`);
                checkpointsProvider.refresh();
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
                    showAutoHideMessage(`✅ Restored from checkpoint "${selected.label}"`);
                    checkpointsProvider.refresh();
                    
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
    vscode.window.showInformationMessage('✅ Code quality check feature is not available.');
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

async function restoreCheckpointFromTree(item: CheckpointItem) {
    const manager = await getCheckpointManager();
    if (!manager) {return;}

    // Confirm restoration
    const confirm = await vscode.window.showWarningMessage(
        `Are you sure you want to restore "${item.name}"? This will overwrite your current code.`,
        { modal: true },
        'Yes, Restore'
    );

    if (confirm === 'Yes, Restore') {
        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Restoring checkpoint "${item.name}"...`,
                cancellable: false
            }, async () => {
                const success = manager.restoreCheckpoint(item.name);
                
                if (success) {
                    showAutoHideMessage(`✅ Restored from checkpoint "${item.name}"`);
                    checkpointsProvider.refresh();
                    
                    // Reload the workspace
                    vscode.commands.executeCommand('workbench.action.reloadWindow');
                } else {
                    vscode.window.showErrorMessage(`Failed to restore checkpoint "${item.name}"`);
                }
            });
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to restore checkpoint: ${error}`);
        }
    }
}

async function deleteCheckpointFromTree(item: CheckpointItem) {
    const manager = await getCheckpointManager();
    if (!manager) {
        vscode.window.showErrorMessage('Checkpoint manager not available');
        return;
    }

    // Confirm deletion
    const confirm = await vscode.window.showWarningMessage(
        `Are you sure you want to delete checkpoint "${item.name}"? This action cannot be undone.`,
        { modal: true },
        'Yes, Delete'
    );

    if (confirm === 'Yes, Delete') {
        try {
            console.log(`[DEBUG] User confirmed deletion of checkpoint: ${item.name}`);
            const success = manager.deleteCheckpoint(item.name);
            
            if (success) {
                showAutoHideMessage(`✅ Deleted checkpoint "${item.name}"`);
                checkpointsProvider.refresh();
            } else {
                vscode.window.showErrorMessage(`Failed to delete checkpoint "${item.name}". Check the console for details.`);
            }
        } catch (error) {
            console.error(`[DEBUG] Error in deleteCheckpointFromTree:`, error);
            vscode.window.showErrorMessage(`Failed to delete checkpoint: ${error}`);
        }
    } else {
        console.log(`[DEBUG] User cancelled deletion of checkpoint: ${item.name}`);
    }
}

async function viewCheckpointFiles(item: CheckpointItem) {
    const manager = await getCheckpointManager();
    if (!manager) {
        vscode.window.showErrorMessage('Checkpoint manager not available');
        return;
    }

    try {
        const checkpointPath = path.join(manager['checkpointDir'], item.name);
        
        if (!fs.existsSync(checkpointPath)) {
            vscode.window.showErrorMessage(`Checkpoint "${item.name}" not found`);
            return;
        }

        // Get list of files in the checkpoint
        const files = getFilesInDirectory(checkpointPath);
        
        // Create a webview to display the files
        const panel = vscode.window.createWebviewPanel(
            'checkpointFiles',
            `Files in ${item.name}`,
            vscode.ViewColumn.One,
            { enableScripts: true }
        );

        panel.webview.html = getWebviewContent(item.name, files);
        
        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(async (message) => {
            if (message.command === 'openFile') {
                const filePath = path.join(checkpointPath, message.filePath);
                if (fs.existsSync(filePath)) {
                    const doc = await vscode.workspace.openTextDocument(filePath);
                    await vscode.window.showTextDocument(doc);
                }
            }
        });

    } catch (error) {
        vscode.window.showErrorMessage(`Failed to view checkpoint files: ${error}`);
    }
}

async function deleteAllCheckpoints() {
    const manager = await getCheckpointManager();
    if (!manager) {
        vscode.window.showErrorMessage('Checkpoint manager not available');
        return;
    }

    // Confirm deletion
    const confirm = await vscode.window.showWarningMessage(
        `Are you sure you want to delete ALL checkpoints? This action cannot be undone.`,
        { modal: true },
        'Yes, Delete All'
    );

    if (confirm === 'Yes, Delete All') {
        try {
            const metadata = manager['loadMetadata']();
            const checkpointCount = Object.keys(metadata).length;
            
            if (checkpointCount === 0) {
                vscode.window.showInformationMessage('No checkpoints to delete');
                return;
            }

            // Delete all checkpoints
            let deletedCount = 0;
            for (const name of Object.keys(metadata)) {
                if (manager.deleteCheckpoint(name)) {
                    deletedCount++;
                }
            }

            showAutoHideMessage(`✅ Deleted ${deletedCount} checkpoints`);
            checkpointsProvider.refresh();
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to delete all checkpoints: ${error}`);
        }
    }
}

function getFilesInDirectory(dirPath: string, relativePath: string = ''): string[] {
    const files: string[] = [];
    const excludePatterns = ['.checkpoints', '.git', 'node_modules', '__pycache__', '.vscode'];

    try {
        const items = fs.readdirSync(dirPath);
        
        for (const item of items) {
            if (excludePatterns.includes(item)) continue;
            
            const fullPath = path.join(dirPath, item);
            const itemRelativePath = relativePath ? path.join(relativePath, item) : item;
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory()) {
                files.push(...getFilesInDirectory(fullPath, itemRelativePath));
            } else {
                files.push(itemRelativePath);
            }
        }
    } catch (error) {
        console.error('Error reading directory:', error);
    }

    return files.sort();
}

function getWebviewContent(checkpointName: string, files: string[]): string {
    const fileList = files.map(file => 
        `<div class="file-item" onclick="openFile('${file}')">
            <span class="file-icon">${file.includes('.') ? '📄' : '📁'}</span>
            <span class="file-name">${file}</span>
        </div>`
    ).join('');

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Files in ${checkpointName}</title>
        <style>
            body { font-family: var(--vscode-font-family); padding: 20px; }
            .file-item { 
                display: flex; 
                align-items: center; 
                padding: 8px; 
                cursor: pointer; 
                border-radius: 4px;
                margin: 2px 0;
            }
            .file-item:hover { background-color: var(--vscode-list-hoverBackground); }
            .file-icon { margin-right: 8px; font-size: 16px; }
            .file-name { font-family: var(--vscode-editor-font-family); }
            .header { margin-bottom: 20px; }
            .count { color: var(--vscode-descriptionForeground); }
        </style>
    </head>
    <body>
        <div class="header">
            <h2>Files in ${checkpointName}</h2>
            <p class="count">${files.length} files</p>
        </div>
        <div class="file-list">
            ${fileList}
        </div>
        <script>
            const vscode = acquireVsCodeApi();
            function openFile(filePath) {
                vscode.postMessage({ command: 'openFile', filePath: filePath });
            }
        </script>
    </body>
    </html>`;
}

function showAutoHideMessage(message: string, duration: number = 3000) {
    const tempStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
    tempStatusBar.text = message;
    tempStatusBar.show();
    
    setTimeout(() => {
        tempStatusBar.hide();
        tempStatusBar.dispose();
    }, duration);
}

export function deactivate() {
    vscode.commands.executeCommand('setContext', 'checkpoints.enabled', false);
}
