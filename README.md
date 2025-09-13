# Code Checkpoints Extension

**One-click code checkpoints: save, restore, and experiment fearlessly with AI.**

Perfect for **Cursor**, **VS Code**, and **AI-assisted coding**! When working with AI assistants like Copilot, Claude, or ChatGPT, you often try multiple code suggestions rapidly. But what happens when an AI-generated change breaks your working code? Rolling back through git commits is slow and disruptive. You need **instant, hassle-free checkpoints** that let you experiment boldly and restore quickly when things go wrong.

This extension creates **checkpoints** of your entire project, working independently of git with zero setup required.

## The Problem This Solves

### 🤖 **AI Coding Challenges:**
- AI suggests code changes that might break your working project
- You want to try multiple AI-generated solutions rapidly
- Git commits feel too heavy for experimental iterations
- You need to bypass git hooks, CI checks, and quality gates
- You want to save progress even when your code doesn't compile

### 💡 **The Solution:**
- **Instant checkpoints** with a single keypress (`Cmd+Shift+S`)
- **One-click restore** to any previous working state (`Cmd+Shift+R`)
- **Works immediately** - no git setup, no configuration, no dependencies
- **Complete project snapshots** - not just individual files
- **Bypass all gates** - save even broken, uncommittable code

Perfect for AI-assisted coding where you need frequent, reliable save points with zero friction!

## Features

- **Quick Checkpoints**: Save your current state instantly with `Cmd+Shift+S` (Mac) or `Ctrl+Shift+S` (Windows/Linux)
- **Named Checkpoints**: Create descriptive checkpoints for important milestones
- **Easy Restoration**: Browse and restore from any checkpoint
- **Quality Gates Bypass**: Works independently of git quality gates
- **Code Quality Check**: Validate complexity before proceeding

## Commands

- `Code Checkpoints: Save Checkpoint` - Create a named checkpoint with description
- `Code Checkpoints: Quick Checkpoint` - Create a timestamped checkpoint instantly
- `Code Checkpoints: List Checkpoints` - View all available checkpoints
- `Code Checkpoints: Restore Checkpoint` - Restore from a selected checkpoint
- `Code Checkpoints: Check Code Quality` - Verify code complexity
- `Code Checkpoints: Clean Old Checkpoints` - Remove old checkpoints

## Keyboard Shortcuts

- `Cmd+Shift+S` / `Ctrl+Shift+S` - Quick Checkpoint
- `Cmd+Shift+L` / `Ctrl+Shift+L` - List Checkpoints
- `Cmd+Shift+R` / `Ctrl+Shift+R` - Restore Checkpoint

## Requirements

- **None!** The extension is completely self-contained

## Cursor Compatibility

✅ **Fully compatible with Cursor!** This extension works seamlessly in:
- **Cursor** (recommended for AI coding)
- **VS Code** 

The extension uses standard VS Code APIs, so it works identically in both editors. Perfect for AI-assisted development workflows!

## Usage

1. Install the extension
2. Use `Cmd+Shift+S` before making changes with AI
3. If something breaks, use `Cmd+Shift+R` to restore
4. Use the status bar button for quick access

## Installation

### For Cursor Users:
1. Open Cursor
2. Go to Extensions (Cmd+Shift+X / Ctrl+Shift+X)
3. Search for "Code Checkpoints" and install
4. Or install from [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=pritam-ajmire.code-checkpoints)

### For VS Code Users:
1. Open VS Code
2. Go to Extensions (Cmd+Shift+X / Ctrl+Shift+X)  
3. Search for "Code Checkpoints" and install
4. Or install from [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=pritam-ajmire.code-checkpoints)

### Quick Start:
1. Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
2. Type "Code Checkpoints" to see all available commands


## How It Works

The extension creates a `.vscode/checkpoints` folder in your workspace to store snapshots of your entire project. Each checkpoint is a complete copy of your files at that moment, with metadata about when it was created and what it contains. This folder is automatically ignored by git and most development tools to keep your project clean.

