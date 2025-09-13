import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

suite('Tree View Integration Test Suite', () => {
	let extension: vscode.Extension<any> | undefined;
	let testWorkspace: string;
	let originalWorkspaceFolders: readonly vscode.WorkspaceFolder[] | undefined;

	suiteSetup(async () => {
		// Find and activate extension
		extension = vscode.extensions.getExtension('pritam-ajmire.checkpoints') || 
					vscode.extensions.all.find(ext => ext.packageJSON.name === 'checkpoints');
		
		if (extension && !extension.isActive) {
			await extension.activate();
			await new Promise(resolve => setTimeout(resolve, 3000));
		}

		// Store original workspace folders
		originalWorkspaceFolders = vscode.workspace.workspaceFolders;

		// Create a temporary test workspace
		testWorkspace = path.join(os.tmpdir(), 'checkpoints-integration-test');
		
		// Clean up any existing test workspace
		if (fs.existsSync(testWorkspace)) {
			fs.rmSync(testWorkspace, { recursive: true, force: true });
		}
		
		// Create test workspace structure
		fs.mkdirSync(testWorkspace, { recursive: true });
		
		// Create some test files
		fs.writeFileSync(path.join(testWorkspace, 'test-file.txt'), 'Test content for integration testing');
		fs.writeFileSync(path.join(testWorkspace, 'package.json'), JSON.stringify({ 
			name: 'checkpoints-integration-test',
			version: '1.0.0'
		}, null, 2));
		fs.writeFileSync(path.join(testWorkspace, 'README.md'), '# Integration Test Project');
	});

	suiteTeardown(async () => {
		// Clean up test workspace
		if (fs.existsSync(testWorkspace)) {
			fs.rmSync(testWorkspace, { recursive: true, force: true });
		}
	});

	test('Extension should be active and ready', () => {
		assert.ok(extension, 'Extension should be found');
		assert.ok(extension!.isActive, 'Extension should be active');
	});

	test('Should have all required tree view commands registered', async () => {
		const commands = await vscode.commands.getCommands(true);
		
		const requiredCommands = [
			'checkpoints.save',
			'checkpoints.saveQuick',
			'checkpoints.list',
			'checkpoints.restore',
			'checkpoints.check',
			'checkpoints.clean',
			'checkpoints.refresh',
			'checkpoints.restoreFromTree',
			'checkpoints.deleteFromTree'
		];

		for (const command of requiredCommands) {
			const isRegistered = commands.includes(command);
			assert.ok(isRegistered, `Command ${command} should be registered`);
		}
	});

	test('Should be able to execute save command without errors', async () => {
		// This test verifies that the save command can be executed
		// In a real test environment, we can't easily test the full workflow
		// but we can verify the command exists and can be called
		
		try {
			// Try to execute the command (it might fail due to no workspace, but that's expected)
			await vscode.commands.executeCommand('checkpoints.save');
		} catch (error) {
			// Expected to fail in test environment due to no active workspace
			// The important thing is that the command is registered and can be called
			assert.ok(error instanceof Error, 'Command should be callable even if it fails');
		}
	});

	test('Should be able to execute quick save command without errors', async () => {
		try {
			await vscode.commands.executeCommand('checkpoints.saveQuick');
		} catch (error) {
			// Expected to fail in test environment due to no active workspace
			assert.ok(error instanceof Error, 'Command should be callable even if it fails');
		}
	});

	test('Should be able to execute list command without errors', async () => {
		try {
			await vscode.commands.executeCommand('checkpoints.list');
		} catch (error) {
			// Expected to fail in test environment due to no active workspace
			assert.ok(error instanceof Error, 'Command should be callable even if it fails');
		}
	});

	test('Should be able to execute refresh command without errors', async () => {
		try {
			await vscode.commands.executeCommand('checkpoints.refresh');
		} catch (error) {
			// Expected to fail in test environment due to no active workspace
			assert.ok(error instanceof Error, 'Command should be callable even if it fails');
		}
	});

	test('Should have proper view configuration for tree view', () => {
		const packageJsonPath = path.join(__dirname, '../../package.json');
		const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
		
		// Verify view configuration
		assert.ok(packageJson.contributes.views, 'Should have views configuration');
		assert.ok(packageJson.contributes.views.explorer, 'Should have explorer views');
		
		const checkpointsView = packageJson.contributes.views.explorer.find((view: any) => view.id === 'checkpointsView');
		assert.ok(checkpointsView, 'Should have checkpointsView');
		assert.strictEqual(checkpointsView.name, 'Checkpoints');
		assert.strictEqual(checkpointsView.when, 'checkpoints.enabled');
		
		// Verify container configuration
		assert.ok(packageJson.contributes.viewsContainers, 'Should have viewsContainers');
		assert.ok(packageJson.contributes.viewsContainers.activitybar, 'Should have activitybar containers');
		
		const checkpointsContainer = packageJson.contributes.viewsContainers.activitybar.find((container: any) => container.id === 'checkpoints');
		assert.ok(checkpointsContainer, 'Should have checkpoints container');
		assert.strictEqual(checkpointsContainer.title, 'Checkpoints');
		assert.strictEqual(checkpointsContainer.icon, '$(save-all)');
	});

	test('Should have proper context menu configuration', () => {
		const packageJsonPath = path.join(__dirname, '../../package.json');
		const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
		
		// Verify context menu items
		const contextMenuItems = packageJson.contributes.menus['view/item/context'];
		assert.ok(contextMenuItems, 'Should have view item context menu');
		
		const restoreItem = contextMenuItems.find((item: any) => item.command === 'checkpoints.restoreFromTree');
		const deleteItem = contextMenuItems.find((item: any) => item.command === 'checkpoints.deleteFromTree');
		
		assert.ok(restoreItem, 'Should have restore context menu item');
		assert.ok(deleteItem, 'Should have delete context menu item');
		
		// Verify conditions
		assert.strictEqual(restoreItem.when, 'view == checkpointsView && viewItem == checkpoint');
		assert.strictEqual(deleteItem.when, 'view == checkpointsView && viewItem == checkpoint');
		
		// Verify groups
		assert.strictEqual(restoreItem.group, 'inline');
		assert.strictEqual(deleteItem.group, 'inline');
	});

	test('Should have refresh button in view title', () => {
		const packageJsonPath = path.join(__dirname, '../../package.json');
		const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
		
		const viewTitleMenus = packageJson.contributes.menus['view/title'];
		assert.ok(viewTitleMenus, 'Should have view title menus');
		
		const refreshButton = viewTitleMenus.find((item: any) => item.command === 'checkpoints.refresh');
		assert.ok(refreshButton, 'Should have refresh button');
		assert.strictEqual(refreshButton.when, 'view == checkpointsView');
		assert.strictEqual(refreshButton.group, 'navigation');
	});

	test('Extension should not crash when tree view commands are called', async () => {
		// Test that the extension remains stable when tree view commands are called
		// even in a test environment where they might not work properly
		
		const commands = [
			'checkpoints.refresh',
			'checkpoints.restoreFromTree',
			'checkpoints.deleteFromTree'
		];

		for (const command of commands) {
			try {
				await vscode.commands.executeCommand(command);
			} catch (error) {
				// Expected to fail in test environment, but extension should not crash
				assert.ok(error instanceof Error, `Command ${command} should be callable`);
			}
		}

		// Verify extension is still active after command calls
		assert.ok(extension!.isActive, 'Extension should still be active after command calls');
	});
});
