# Publishing Guide

## First Time Setup

### 1. Create npm Account & Token
```bash
# Visit https://npmjs.com and create account
# Go to https://npmjs.com/settings/tokens
# Generate "Automation" token
# Copy the token (save it securely!)
```

### 2. Add NPM_TOKEN to GitHub Secrets
```bash
# Go to: https://github.com/divyeshradadiya/serpex-mcp/settings/secrets/actions
# Click "New repository secret"
# Name: NPM_TOKEN
# Value: [paste your npm token]
```

### 3. Initial Publish (Manual)
```bash
# Make sure you're logged in to npm
npm login

# Publish manually first time
npm publish
```

## Auto-Publishing Setup

Publishing happens automatically when:

### On Every Push to Main:
- Push code changes to `main` branch → Auto-publish to npm
- Version automatically bumps by patch (1.0.0 → 1.0.1)
- Creates git tag and pushes back to repo

### What Triggers Publishing:
- Changes to `src/` files
- Changes to `package.json`
- Changes to `.github/workflows/publish-npm.yml`

## Version Management

### Automatic Version Bumping:
- Patch version bumps automatically on every publish
- No manual version management needed
- Git tags are created automatically

### Automatic Version Bumping:
- Patch version bumps automatically on every publish
- No manual version management needed
- Git tags are created automatically

## Manual Publishing

If needed, publish manually:
```bash
npm login
npm publish
```

If needed, publish manually:
```bash
npm login
npm publish
```

## Troubleshooting

### Publish Fails - 403 Forbidden
- Check NPM_TOKEN secret is correct
- Verify token has publish permissions
- Make sure package name isn't taken

### Version Already Exists
- Update version with `npm version patch`
- Commit and push again

### Build Fails
- Check TypeScript compilation: `pnpm build`
- Run tests: `pnpm test`
- Fix any errors before pushing

## What's Published

The npm package includes:
- ✅ Compiled JavaScript (`build/`)
- ✅ TypeScript definitions
- ✅ package.json
- ✅ README.md
- ❌ node_modules (excluded)
- ❌ src/ (compiled to build/)

## Testing Before Publish

```bash
# Install locally
npm install -g .

# Test the binary
serpex-mcp --help

# Test with API key
SERPEX_API_KEY=your_key serpex-mcp
```