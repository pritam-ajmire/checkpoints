import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// Import the CheckpointManager class - we need to export it from extension.ts
suite('CheckpointManager Test Suite', () => {
	let testWorkspace: string;
	let checkpointManager: any;

	// Create a CheckpointManager class for testing (copied from extension.ts)
	class TestCheckpointManager {
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

		loadMetadata(): any {
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

		saveMetadata(metadata: any): void {
			fs.writeFileSync(this.metadataFile, JSON.stringify(metadata, null, 2));
		}

		private copyDirectory(src: string, dest: string, excludePatterns: string[] = ['.checkpoints', '.git', 'node_modules', '__pycache__']): number {
			let fileCount = 0;
			
			if (!fs.existsSync(dest)) {
				fs.mkdirSync(dest, { recursive: true });
			}

			const items = fs.readdirSync(src);
			
			for (const item of items) {
				if (excludePatterns.includes(item)) continue;
				
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
			if (!fs.existsSync(dirPath)) return;
			
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

		listCheckpoints(): any {
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
					if (item === '.checkpoints' || item === '.git') continue;
					
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
				const checkpointTime = new Date((info as any).timestamp);
				if (checkpointTime < cutoff && !name.startsWith('auto_backup')) {
					if (this.deleteCheckpoint(name)) {
						deletedCount++;
					}
				}
			}
			
			return deletedCount;
		}
	}

	setup(async () => {
		// Create a temporary workspace for testing
		testWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), 'checkpoint-test-'));
		checkpointManager = new TestCheckpointManager(testWorkspace);
		
		// Create some test files
		fs.writeFileSync(path.join(testWorkspace, 'test1.txt'), 'Test file 1 content');
		fs.writeFileSync(path.join(testWorkspace, 'test2.js'), 'console.log("test");');
		fs.mkdirSync(path.join(testWorkspace, 'subdir'));
		fs.writeFileSync(path.join(testWorkspace, 'subdir', 'test3.py'), 'print("hello")');
	});

	teardown(() => {
		// Clean up test workspace
		if (fs.existsSync(testWorkspace)) {
			fs.rmSync(testWorkspace, { recursive: true, force: true });
		}
	});

	test('Should create checkpoint directory', () => {
		const checkpointDir = path.join(testWorkspace, '.checkpoints');
		assert.strictEqual(fs.existsSync(checkpointDir), true);
	});

	test('Should save checkpoint successfully', () => {
		const result = checkpointManager.saveCheckpoint('test-checkpoint', 'Test checkpoint description');
		assert.strictEqual(result, true);
		
		// Verify checkpoint directory exists
		const checkpointPath = path.join(testWorkspace, '.checkpoints', 'test-checkpoint');
		assert.strictEqual(fs.existsSync(checkpointPath), true);
		
		// Verify files were copied
		assert.strictEqual(fs.existsSync(path.join(checkpointPath, 'test1.txt')), true);
		assert.strictEqual(fs.existsSync(path.join(checkpointPath, 'test2.js')), true);
		assert.strictEqual(fs.existsSync(path.join(checkpointPath, 'subdir', 'test3.py')), true);
	});

	test('Should list checkpoints correctly', () => {
		checkpointManager.saveCheckpoint('checkpoint1', 'First checkpoint');
		checkpointManager.saveCheckpoint('checkpoint2', 'Second checkpoint');
		
		const checkpoints = checkpointManager.listCheckpoints();
		assert.strictEqual(Object.keys(checkpoints).length, 2);
		assert.strictEqual(checkpoints.checkpoint1.description, 'First checkpoint');
		assert.strictEqual(checkpoints.checkpoint2.description, 'Second checkpoint');
	});

	test('Should restore checkpoint correctly', () => {
		// Save initial checkpoint
		checkpointManager.saveCheckpoint('initial', 'Initial state');
		
		// Modify files
		fs.writeFileSync(path.join(testWorkspace, 'test1.txt'), 'Modified content');
		fs.writeFileSync(path.join(testWorkspace, 'new-file.txt'), 'New file content');
		
		// Restore checkpoint
		const result = checkpointManager.restoreCheckpoint('initial');
		assert.strictEqual(result, true);
		
		// Verify restoration
		const content = fs.readFileSync(path.join(testWorkspace, 'test1.txt'), 'utf8');
		assert.strictEqual(content, 'Test file 1 content');
		assert.strictEqual(fs.existsSync(path.join(testWorkspace, 'new-file.txt')), false);
	});

	test('Should delete checkpoint correctly', () => {
		checkpointManager.saveCheckpoint('to-delete', 'Checkpoint to delete');
		
		const result = checkpointManager.deleteCheckpoint('to-delete');
		assert.strictEqual(result, true);
		
		// Verify checkpoint is deleted
		const checkpointPath = path.join(testWorkspace, '.checkpoints', 'to-delete');
		assert.strictEqual(fs.existsSync(checkpointPath), false);
		
		// Verify metadata is updated
		const checkpoints = checkpointManager.listCheckpoints();
		assert.strictEqual(checkpoints['to-delete'], undefined);
	});

	test('Should clean old checkpoints correctly', () => {
		// Create a recent checkpoint
		checkpointManager.saveCheckpoint('recent', 'Recent checkpoint');
		
		// Create an actual old checkpoint using the manager
		checkpointManager.saveCheckpoint('old-checkpoint', 'Old checkpoint for testing');
		
		// Manually modify the metadata to make it old
		const metadata = checkpointManager.loadMetadata();
		const oldDate = new Date();
		oldDate.setDate(oldDate.getDate() - 10);
		
		// Update the old checkpoint's timestamp in metadata using proper ISO string format
		if (metadata['old-checkpoint']) {
			metadata['old-checkpoint'].timestamp = oldDate.toISOString();
			
			// Save the modified metadata directly using the manager's method
			checkpointManager.saveMetadata(metadata);
		}
		
		// Clean checkpoints older than 7 days
		const deletedCount = checkpointManager.cleanOldCheckpoints(7);
		assert.strictEqual(deletedCount, 1);
		
		// Verify old checkpoint is deleted, recent one remains
		const checkpoints = checkpointManager.listCheckpoints();
		assert.strictEqual(checkpoints['old-checkpoint'], undefined);
		assert.notStrictEqual(checkpoints['recent'], undefined);
	});

	test('Should handle non-existent checkpoint restore gracefully', () => {
		const result = checkpointManager.restoreCheckpoint('non-existent');
		assert.strictEqual(result, false);
	});

	test('Should handle non-existent checkpoint delete gracefully', () => {
		const result = checkpointManager.deleteCheckpoint('non-existent');
		assert.strictEqual(result, false);
	});

	test('Should exclude specified patterns when copying', () => {
		// Create files that should be excluded
		fs.mkdirSync(path.join(testWorkspace, 'node_modules'));
		fs.writeFileSync(path.join(testWorkspace, 'node_modules', 'package.json'), '{}');
		fs.mkdirSync(path.join(testWorkspace, '.git'));
		fs.writeFileSync(path.join(testWorkspace, '.git', 'config'), 'git config');
		
		checkpointManager.saveCheckpoint('exclude-test', 'Test exclusion patterns');
		
		const checkpointPath = path.join(testWorkspace, '.checkpoints', 'exclude-test');
		assert.strictEqual(fs.existsSync(path.join(checkpointPath, 'node_modules')), false);
		assert.strictEqual(fs.existsSync(path.join(checkpointPath, '.git')), false);
		assert.strictEqual(fs.existsSync(path.join(checkpointPath, '.checkpoints')), false);
	});
});
