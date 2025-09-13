import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// Mock CheckpointManager for testing incremental functionality
class MockCheckpointManager {
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

    private loadMetadata(): any {
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

    private saveMetadata(metadata: any): void {
        fs.writeFileSync(this.metadataFile, JSON.stringify(metadata, null, 2));
    }

    private getFileInfo(filePath: string): any {
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
            const crypto = require('crypto');
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

    private getFileList(dirPath: string, relativePath: string = ''): Map<string, any> {
        const files = new Map<string, any>();
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
                const destDir = path.dirname(destPath);
                if (!fs.existsSync(destDir)) {
                    fs.mkdirSync(destDir, { recursive: true });
                }
                
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
            .filter(([_, meta]: [string, any]) => !meta.isIncremental)
            .sort((a, b) => (b[1] as any).timestamp.localeCompare((a[1] as any).timestamp));
        
        return checkpoints.length > 0 ? checkpoints[0][0] : null;
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

    saveCheckpoint(name: string, description: string, forceFull: boolean = false): boolean {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const checkpointPath = path.join(this.checkpointDir, name);
            
            if (fs.existsSync(checkpointPath)) {
                fs.rmSync(checkpointPath, { recursive: true, force: true });
            }
            
            let fileCount = 0;
            let isIncremental = false;
            let baseCheckpoint: string | undefined;
            let changedFiles: string[] = [];
            let totalSize = 0;
            let incrementalSize = 0;
            
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
                        
                        if (changedFiles.length > 0 && changedFiles.length < 100) {
                            console.log(`[DEBUG] Creating incremental checkpoint`);
                            isIncremental = true;
                            baseCheckpoint = lastCheckpoint;
                            
                            fileCount = this.copyIncrementalFiles(changedFiles, baseCheckpointPath, checkpointPath);
                            
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
            
            if (!isIncremental) {
                fileCount = this.copyDirectory(this.workspaceRoot, checkpointPath);
                totalSize = this.calculateDirectorySize(checkpointPath);
                incrementalSize = totalSize;
            }
            
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

    listCheckpoints(): any {
        return this.loadMetadata();
    }
}

suite('Incremental Checkpoint Test Suite', () => {
    let testWorkspace: string;
    let manager: MockCheckpointManager;

    suiteSetup(async () => {
        // Create a temporary test workspace
        testWorkspace = path.join(os.tmpdir(), 'checkpoints-incremental-test');
        
        // Clean up any existing test workspace
        if (fs.existsSync(testWorkspace)) {
            fs.rmSync(testWorkspace, { recursive: true, force: true });
        }
        
        // Create test workspace structure
        fs.mkdirSync(testWorkspace, { recursive: true });
        
        // Create some test files
        fs.writeFileSync(path.join(testWorkspace, 'file1.txt'), 'Initial content 1');
        fs.writeFileSync(path.join(testWorkspace, 'file2.txt'), 'Initial content 2');
        fs.writeFileSync(path.join(testWorkspace, 'package.json'), JSON.stringify({ name: 'test-project' }, null, 2));
        
        manager = new MockCheckpointManager(testWorkspace);
    });

    suiteTeardown(async () => {
        // Clean up test workspace
        if (fs.existsSync(testWorkspace)) {
            fs.rmSync(testWorkspace, { recursive: true, force: true });
        }
    });

    test('Should create full checkpoint initially', () => {
        const success = manager.saveCheckpoint('initial', 'Initial checkpoint');
        
        assert.ok(success, 'Initial checkpoint should be created successfully');
        
        const checkpoints = manager.listCheckpoints();
        const initialCheckpoint = checkpoints['initial'];
        
        assert.ok(initialCheckpoint, 'Initial checkpoint should exist');
        assert.strictEqual(initialCheckpoint.isIncremental, false, 'Initial checkpoint should not be incremental');
        assert.strictEqual(initialCheckpoint.fileCount, 3, 'Should have 3 files');
        assert.ok(initialCheckpoint.totalSize > 0, 'Should have positive size');
    });

    test('Should create incremental checkpoint when files change', () => {
        // Modify a file
        fs.writeFileSync(path.join(testWorkspace, 'file1.txt'), 'Modified content 1');
        
        // Create new file
        fs.writeFileSync(path.join(testWorkspace, 'file3.txt'), 'New content 3');
        
        const success = manager.saveCheckpoint('modified', 'Modified checkpoint');
        
        assert.ok(success, 'Modified checkpoint should be created successfully');
        
        const checkpoints = manager.listCheckpoints();
        const modifiedCheckpoint = checkpoints['modified'];
        
        assert.ok(modifiedCheckpoint, 'Modified checkpoint should exist');
        assert.strictEqual(modifiedCheckpoint.isIncremental, true, 'Modified checkpoint should be incremental');
        assert.strictEqual(modifiedCheckpoint.baseCheckpoint, 'initial', 'Should be based on initial checkpoint');
        assert.ok(modifiedCheckpoint.changedFiles, 'Should have changed files list');
        assert.ok(modifiedCheckpoint.changedFiles.length > 0, 'Should have some changed files');
        assert.ok(modifiedCheckpoint.incrementalSize < modifiedCheckpoint.totalSize, 'Incremental size should be smaller than total size');
    });

    test('Should force full checkpoint when requested', () => {
        const success = manager.saveCheckpoint('forced_full', 'Forced full checkpoint', true);
        
        assert.ok(success, 'Forced full checkpoint should be created successfully');
        
        const checkpoints = manager.listCheckpoints();
        const forcedCheckpoint = checkpoints['forced_full'];
        
        assert.ok(forcedCheckpoint, 'Forced full checkpoint should exist');
        assert.strictEqual(forcedCheckpoint.isIncremental, false, 'Forced checkpoint should not be incremental');
        assert.strictEqual(forcedCheckpoint.fileCount, 4, 'Should have 4 files (including new file)');
    });

    test('Should handle file change detection correctly', () => {
        // Create a new checkpoint to test change detection
        manager.saveCheckpoint('test_base', 'Test base checkpoint');
        
        // Modify existing file
        fs.writeFileSync(path.join(testWorkspace, 'file2.txt'), 'Updated content 2');
        
        // Delete a file
        fs.unlinkSync(path.join(testWorkspace, 'file3.txt'));
        
        // Create new file
        fs.writeFileSync(path.join(testWorkspace, 'file4.txt'), 'New content 4');
        
        const success = manager.saveCheckpoint('test_changes', 'Test changes checkpoint');
        
        assert.ok(success, 'Test changes checkpoint should be created successfully');
        
        const checkpoints = manager.listCheckpoints();
        const changesCheckpoint = checkpoints['test_changes'];
        
        assert.ok(changesCheckpoint, 'Changes checkpoint should exist');
        assert.strictEqual(changesCheckpoint.isIncremental, true, 'Should be incremental');
        assert.ok(changesCheckpoint.changedFiles, 'Should have changed files');
        
        // Should detect modified file2.txt and new file4.txt
        const changedFiles = changesCheckpoint.changedFiles;
        assert.ok(changedFiles.includes('file2.txt'), 'Should detect modified file2.txt');
        assert.ok(changedFiles.includes('file4.txt'), 'Should detect new file4.txt');
    });

    test('Should calculate sizes correctly', () => {
        const checkpoints = manager.listCheckpoints();
        const incrementalCheckpoint = checkpoints['modified'];
        
        if (incrementalCheckpoint && incrementalCheckpoint.isIncremental) {
            assert.ok(incrementalCheckpoint.totalSize > 0, 'Total size should be positive');
            assert.ok(incrementalCheckpoint.incrementalSize > 0, 'Incremental size should be positive');
            assert.ok(incrementalCheckpoint.incrementalSize < incrementalCheckpoint.totalSize, 'Incremental size should be smaller than total size');
        }
    });
});
