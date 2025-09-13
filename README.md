# Code Checkpoints Extension

**One-click code checkpoints: save, restore, and experiment fearlessly with AI.**

When working with AI assistants like Copilot, Claude, or ChatGPT, you often try multiple code suggestions rapidly. But what happens when an AI-generated change breaks your working code? Rolling back through git commits is slow and disruptive. You need **instant, hassle-free checkpoints** that let you experiment boldly and restore quickly when things go wrong.

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

## Usage

1. Install the extension
2. Use `Cmd+Shift+S` before making changes with AI
3. If something breaks, use `Cmd+Shift+R` to restore
4. Use the status bar button for quick access

## Installation

1. Download from the Visual Studio Marketplace Or search for "Code Checkpoints" in VSCode's Extensions view and install.
2. Open VS Code or Cursor
3. Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)


## How It Works

The extension creates a `.vscode/checkpoints` folder in your workspace to store snapshots of your entire project. Each checkpoint is a complete copy of your files at that moment, with metadata about when it was created and what it contains. This folder is automatically ignored by git and most development tools to keep your project clean.

## For Developers

- **Developer Guide**: See DEV-README.md for setup, testing, and contributing
- **Package Details**: See PACKAGE_INFO.md for technical specifications
