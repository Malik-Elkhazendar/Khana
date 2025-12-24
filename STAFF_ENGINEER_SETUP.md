# Staff Engineer Agent - Setup Guide

The Staff Engineer Agent analyzes your Khana codebase and automatically recommends the next feature to build. This guide helps you set it up.

## 📋 What You'll Get

When you run the agent, you'll get:

- 📊 Current project state analysis
- 🎯 Next feature recommendation
- 📝 Complete implementation prompt with:
  - Business context
  - Architecture rules (MUST FOLLOW)
  - Design system rules
  - Components to create/reuse
  - Testing requirements
  - Validation steps
  - Commit message format

## 🔧 One-Time Setup

### 1. Get Your OpenAI API Key

1. Go to: https://platform.openai.com/account/api-keys
2. Sign in or create an account
3. Create a new API key
4. Copy the key (it starts with `sk-proj-`)

⚠️ **Important**: Keep your API key secure. Never commit it to git.

### 2. Create .env File

Create a `.env` file in the project root (`C:\Users\malek\Desktop\khana\.env`):

```
OPENAI_API_KEY=sk-proj-your-actual-key-here
```

Replace `sk-proj-your-actual-key-here` with your actual API key.

### 3. Verify Installation

Test that everything works:

```bash
npm run staff-engineer
```

You should see output like:

```
════════════════════════════════════════════════════════════════════════════════
🚀 STAFF ENGINEER AGENT
════════════════════════════════════════════════════════════════════════════════

📊 Analyzing Khana codebase...

[... agent analysis output ...]
```

## 🚀 How to Use

### From Claude Code

Type the custom command:

```
/staff-engineer
```

Claude Code will show the command and expand it.

### From Terminal

```bash
npm run staff-engineer
```

## 📊 Understanding the Output

The agent generates a detailed **Implementation Prompt** with everything you need:

1. **Business Context** - Why this feature matters
2. **Architecture Rules** - Patterns you MUST follow
3. **Design System Rules** - Theme and styling requirements
4. **Components** - What to create and reuse
5. **Testing** - Coverage requirements
6. **Validation** - Pre-commit checks
7. **Commit Message** - Ready-to-use format

## 🎯 Next Steps

1. Copy the entire implementation prompt from the agent output
2. Follow it exactly when building the feature
3. Run pre-commit checks before committing
4. Use the provided commit message

## 🐛 Troubleshooting

### Error: "Missing credentials"

- Make sure you created the `.env` file
- Check the filename - it must be `.env` exactly
- Restart your terminal/IDE after creating the file

### Error: "Incorrect API key provided"

- Go to https://platform.openai.com/account/api-keys
- Verify your API key is correct
- Make sure there are no extra spaces in the `.env` file
- Check your account has credits/is not rate-limited

### Command not found: "npm run staff-engineer"

- Run `npm install` to install dependencies
- Make sure you're in the project root directory

### No output or very slow response

- The agent takes 10-30 seconds to analyze the codebase
- Be patient on first run
- Check your internet connection

## 💡 Tips

- **Run regularly**: Run the agent whenever you're ready for a new feature
- **Keep learning**: The agent learns your patterns over time
- **Follow exactly**: The generated prompts are comprehensive and specific to your project
- **Archive prompts**: Save the generated prompts in a feature branch for reference

## 🔐 Security

- `.env` files are automatically ignored by git (see `.gitignore`)
- Never share your API key in git commits, PRs, or with others
- Rotate your API key periodically in the OpenAI dashboard
- If you accidentally expose your key, revoke it immediately

## 📞 Support

If you have issues:

1. Check the troubleshooting section above
2. Verify your OpenAI API key works at https://platform.openai.com/account/api-keys
3. Check your account has available credits

---

**You're all set!** Run `npm run staff-engineer` to get started.
