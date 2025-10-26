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

### On GitHub Releases:
- Create a release on GitHub → Auto-publish to npm
- Version is read from `package.json`

### Manual Publishing:
- Go to GitHub Actions → "Publish to npm" → "Run workflow"
- Choose version bump type (patch/minor/major)
- Workflow bumps version, creates tag, and publishes

## Version Management

### Before Creating Releases:
Update version in `package.json` manually:

```bash
# Patch version (1.0.0 → 1.0.1) - bug fixes
npm version patch

# Minor version (1.0.0 → 1.1.0) - new features
npm version minor

# Major version (1.0.0 → 2.0.0) - breaking changes
npm version major

# Then commit and push
git add package.json
git commit -m "chore: bump version to X.X.X"
git push
```

### Or Use Manual Workflow:
1. Go to GitHub Actions tab
2. Click "Publish to npm"
3. Click "Run workflow"
4. Choose version type
5. Workflow handles everything automatically

## Manual Publishing

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