# Troubleshooting Guide

## Common Installation Issues

### ❌ "Not compatible with VS Code" Error

**Error**: `Unable to install extension 'undefined_publisher.checkpoints' as it is not compatible with VS Code '1.99.3'`

**Solution**: Use the latest version `checkpoints-x.x.x.vsix` which supports VS Code 1.74.0+

**Fixed in**: v1.0.1
- ✅ Compatible with VS Code 1.74.0+
- ✅ Compatible with Cursor IDE
- ✅ Added proper publisher info

### ❌ "Undefined Publisher" Error

**Error**: Extension shows as `undefined_publisher.checkpoints`

**Solution**: Use v1.0.1 which includes proper publisher metadata

### ❌ Extension Won't Activate

**Symptoms**: 
- Extension installs but commands don't work
- No status bar button appears

**Solutions**:
1. **Restart VS Code/Cursor** after installation
2. **Check workspace**: Extension only works in workspace folders
3. **Verify installation**: Go to Extensions view, search for "Checkpoints"

### ❌ Checkpoint Creation Fails

**Symptoms**: Error messages when trying to save checkpoints

**Solutions**:
1. **Check permissions**: Ensure write access to workspace folder
2. **Check disk space**: Checkpoints need space to copy files
3. **Check file locks**: Close any files that might be locked

### ❌ Commands Not Found

**Symptoms**: Keyboard shortcuts don't work, commands missing from palette

**Solutions**:
1. **Reload window**: Cmd+R (Mac) or Ctrl+R (Windows/Linux)
2. **Check extension status**: Extensions view → Checkpoints → should show "Enabled"
3. **Reinstall extension**: Uninstall and reinstall the .vsix file

## Installation Verification

After installing, verify the extension works:

1. **Open a workspace folder** (not just single files)
2. **Check status bar** - Should see "Checkpoint" button
3. **Test quick checkpoint**: Press `Cmd+Shift+S` / `Ctrl+Shift+S`
4. **Verify checkpoint folder**: Look for `.checkpoints/` in workspace root

## Version Compatibility

| Extension Version | VS Code Version | Cursor Compatible |
|------------------|-----------------|-------------------|
| v1.0.0 | 1.103.0+ | ❌ No |
| v1.0.1 | 1.74.0+ | ✅ Yes |

## Getting Help

If you continue to have issues:

1. **Check VS Code version**: Help → About
2. **Check extension logs**: Developer Tools → Console
3. **Try in clean workspace**: Create new folder and test
4. **Report issue**: Include VS Code version and error details

## Known Limitations

- **Large projects**: Checkpoints copy entire workspace (may be slow)
- **File permissions**: Requires write access to workspace
- **Disk space**: Each checkpoint uses project size worth of disk space
- **Symbolic links**: May not handle symlinks correctly

## Debug Mode

To enable debug output:

1. Open **Developer Tools** (Help → Toggle Developer Tools)
2. Go to **Console** tab
3. Look for "Checkpoints extension" messages
4. Errors will show stack traces for debugging
