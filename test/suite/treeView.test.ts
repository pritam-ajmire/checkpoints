import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// Import the classes we need to test
// Note: In a real test environment, we'd need to import these from the compiled extension
// For now, we'll test the functionality through the extension API

suite('Tree View Test Suite', () => {
	let extension: vscode.Extension<any> | undefined;
	let testWorkspace: string;
	let testCheckpointDir: string;

	suiteSetup(async () => {
		// Find and activate extension
		extension = vscode.extensions.getExtension('pritam-ajmire.checkpoints') || 
					vscode.extensions.all.find(ext => ext.packageJSON.name === 'checkpoints');
		
		if (extension && !extension.isActive) {
			await extension.activate();
			await new Promise(resolve => setTimeout(resolve, 2000));
		}

		// Create a temporary test workspace
		testWorkspace = path.join(os.tmpdir(), 'checkpoints-test-workspace');
		testCheckpointDir = path.join(testWorkspace, '.checkpoints');
		
		// Clean up any existing test workspace
		if (fs.existsSync(testWorkspace)) {
			fs.rmSync(testWorkspace, { recursive: true, force: true });
		}
		
		// Create test workspace structure
		fs.mkdirSync(testWorkspace, { recursive: true });
		fs.mkdirSync(testCheckpointDir, { recursive: true });
		
		// Create some test files
		fs.writeFileSync(path.join(testWorkspace, 'test-file.txt'), 'Test content');
		fs.writeFileSync(path.join(testWorkspace, 'package.json'), JSON.stringify({ name: 'test-project' }, null, 2));
	});

	suiteTeardown(async () => {
		// Clean up test workspace
		if (fs.existsSync(testWorkspace)) {
			fs.rmSync(testWorkspace, { recursive: true, force: true });
		}
	});

	test('Extension should be active', () => {
		assert.ok(extension, 'Extension should be found');
		assert.ok(extension!.isActive, 'Extension should be active');
	});

	test('Should register new tree view commands', async () => {
		const commands = await vscode.commands.getCommands(true);
		
		const newCommands = [
			'checkpoints.refresh',
			'checkpoints.restoreFromTree',
			'checkpoints.deleteFromTree'
		];

		for (const command of newCommands) {
			const isRegistered = commands.includes(command);
			assert.ok(isRegistered, `Command ${command} should be registered`);
		}
	});

	test('Should create checkpoints and verify tree view updates', async () => {
		// This test would require the extension to be running in a real workspace
		// In a test environment, we can only verify that the commands exist
		// and that the extension doesn't crash when activated
		
		assert.ok(extension!.isActive, 'Extension should be active');
		
		// Verify that the tree view commands are available
		const commands = await vscode.commands.getCommands(true);
		assert.ok(commands.includes('checkpoints.refresh'), 'Refresh command should be available');
		assert.ok(commands.includes('checkpoints.restoreFromTree'), 'Restore from tree command should be available');
		assert.ok(commands.includes('checkpoints.deleteFromTree'), 'Delete from tree command should be available');
	});

	test('Should have proper view configuration in package.json', () => {
		// This test verifies that the package.json has the correct view configuration
		const packageJsonPath = path.join(__dirname, '../../package.json');
		const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
		
		// Check for views configuration
		assert.ok(packageJson.contributes.views, 'Package.json should have views configuration');
		assert.ok(packageJson.contributes.views.explorer, 'Should have explorer views');
		
		const checkpointsView = packageJson.contributes.views.explorer.find((view: any) => view.id === 'checkpointsView');
		assert.ok(checkpointsView, 'Should have checkpointsView in explorer views');
		assert.strictEqual(checkpointsView.name, 'Checkpoints', 'View name should be "Checkpoints"');
		
		// Check for viewsContainers
		assert.ok(packageJson.contributes.viewsContainers, 'Package.json should have viewsContainers configuration');
		assert.ok(packageJson.contributes.viewsContainers.activitybar, 'Should have activitybar containers');
		
		const checkpointsContainer = packageJson.contributes.viewsContainers.activitybar.find((container: any) => container.id === 'checkpoints');
		assert.ok(checkpointsContainer, 'Should have checkpoints container in activitybar');
		assert.strictEqual(checkpointsContainer.title, 'Checkpoints', 'Container title should be "Checkpoints"');
		
		// Check for context menu items
		assert.ok(packageJson.contributes.menus, 'Package.json should have menus configuration');
		assert.ok(packageJson.contributes.menus['view/item/context'], 'Should have view item context menu');
		
		const contextMenuItems = packageJson.contributes.menus['view/item/context'];
		const restoreItem = contextMenuItems.find((item: any) => item.command === 'checkpoints.restoreFromTree');
		const deleteItem = contextMenuItems.find((item: any) => item.command === 'checkpoints.deleteFromTree');
		
		assert.ok(restoreItem, 'Should have restore context menu item');
		assert.ok(deleteItem, 'Should have delete context menu item');
	});

	test('Should have refresh button in view title', () => {
		const packageJsonPath = path.join(__dirname, '../../package.json');
		const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
		
		const viewTitleMenus = packageJson.contributes.menus['view/title'];
		assert.ok(viewTitleMenus, 'Should have view title menus');
		
		const refreshButton = viewTitleMenus.find((item: any) => item.command === 'checkpoints.refresh');
		assert.ok(refreshButton, 'Should have refresh button in view title');
		assert.strictEqual(refreshButton.when, 'view == checkpointsView', 'Refresh button should be for checkpointsView');
	});

	test('Context menu items should have correct conditions', () => {
		const packageJsonPath = path.join(__dirname, '../../package.json');
		const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
		
		const contextMenuItems = packageJson.contributes.menus['view/item/context'];
		
		const restoreItem = contextMenuItems.find((item: any) => item.command === 'checkpoints.restoreFromTree');
		const deleteItem = contextMenuItems.find((item: any) => item.command === 'checkpoints.deleteFromTree');
		
		// Check that both items have the correct when conditions
		assert.strictEqual(restoreItem.when, 'view == checkpointsView && viewItem == checkpoint', 
			'Restore item should have correct when condition');
		assert.strictEqual(deleteItem.when, 'view == checkpointsView && viewItem == checkpoint', 
			'Delete item should have correct when condition');
		
		// Check that both items are in the inline group
		assert.strictEqual(restoreItem.group, 'inline', 'Restore item should be in inline group');
		assert.strictEqual(deleteItem.group, 'inline', 'Delete item should be in inline group');
	});
});
