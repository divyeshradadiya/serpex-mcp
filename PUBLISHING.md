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

## Publishing (tag-triggered)

`.github/workflows/publish-npm.yml` publishes when a `v*` tag is pushed (or a GitHub release is published). There is no auto-bump:

```bash
# 1. set "version" in package.json, commit, merge to main
# 2. tag and push the tag
git tag v1.1.2 && git push origin v1.1.2
```

A normal push to `main` does not publish.

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