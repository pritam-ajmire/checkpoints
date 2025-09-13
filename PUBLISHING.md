# Publishing Guide

This guide explains how to publish the Code Checkpoints extension to both VS Code and Cursor marketplaces.

## Prerequisites

1. **VS Code Marketplace Account**
   - Create account at: https://marketplace.visualstudio.com/manage
   - Get Personal Access Token (PAT)

2. **OpenVSX Account** (for Cursor)
   - Create account at: https://open-vsx.org/
   - Create namespace: `pritam-ajmire`
   - Get access token

## Installation

Install required tools:

```bash
npm install -g @vscode/vsce
npm install -g ovsx
```

## Publishing Commands

### 1. Package Extension
```bash
npm run package
```
Creates a `.vsix` file for distribution.

### 2. Login to Marketplaces

**VS Code Marketplace:**
```bash
npm run login:vscode
```

**OpenVSX (Cursor):**
```bash
npm run login:openvsx
```

### 3. Publish to Marketplaces

**VS Code Marketplace only:**
```bash
npm run publish:vscode
```

**OpenVSX (Cursor) only:**
```bash
npm run publish:openvsx
```

**Both marketplaces:**
```bash
npm run publish:all
```

## Step-by-Step Publishing Process

### For VS Code Marketplace:

1. **Login:**
   ```bash
   npm run login:vscode
   ```
   Enter your VS Code Personal Access Token when prompted.

2. **Publish:**
   ```bash
   npm run publish:vscode
   ```

3. **Verify:** Check at https://marketplace.visualstudio.com/items?itemName=pritam-ajmire.code-checkpoints

### For Cursor (OpenVSX):

1. **Login:**
   ```bash
   npm run login:openvsx
   ```
   Enter your OpenVSX access token when prompted.

2. **Publish:**
   ```bash
   npm run publish:openvsx
   ```

3. **Verify:** Check at https://open-vsx.org/extension/pritam-ajmire/code-checkpoints

## Version Management

Before publishing, update the version in `package.json`:

```json
{
  "version": "1.1.3"
}
```

Then run:
```bash
npm run publish:all
```

## Troubleshooting

### VS Code Marketplace Issues:
- Ensure you're logged in: `vsce whoami`
- Check if extension exists: `vsce show pritam-ajmire.code-checkpoints`

### OpenVSX Issues:
- Ensure you're logged in: `ovsx whoami`
- Check namespace: `ovsx list pritam-ajmire`

## Quick Reference

| Command | Purpose |
|---------|---------|
| `npm run package` | Create VSIX package |
| `npm run login:vscode` | Login to VS Code marketplace |
| `npm run login:openvsx` | Login to OpenVSX |
| `npm run publish:vscode` | Publish to VS Code |
| `npm run publish:openvsx` | Publish to OpenVSX |
| `npm run publish:all` | Publish to both marketplaces |

## Notes

- **VS Code Marketplace**: Extensions appear immediately after publishing
- **OpenVSX (Cursor)**: May take a few hours to appear in Cursor's marketplace
- **Version Updates**: Always increment version number before publishing
- **Testing**: Test locally before publishing to ensure everything works
