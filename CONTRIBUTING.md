# Contributing to Healthcare Compliance VS Code Extension

Thank you for your interest in contributing to the Healthcare Compliance extension! This document provides guidelines and instructions for contributing.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Documentation](#documentation)

## Code of Conduct

This project adheres to a Code of Conduct that all contributors are expected to follow. Please be respectful, inclusive, and professional in all interactions.

## Getting Started

### Prerequisites

- Node.js 18+ 
- VS Code 1.96+
- Git
- GitHub CLI (optional, for PR workflows)

### Development Setup

1. **Fork the repository**
   ```bash
   gh repo fork gerinsights/healthcare-compliance-vscode
   ```

2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/healthcare-compliance-vscode.git
   cd healthcare-compliance-vscode
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Compile TypeScript**
   ```bash
   npm run compile
   ```

5. **Launch Extension Development Host**
   - Open the project in VS Code
   - Press `F5` to launch a new VS Code window with the extension loaded

### Project Structure

```
healthcare-compliance-vscode/
├── src/
│   ├── extension.ts          # Extension entry point
│   ├── mcp-server.ts         # MCP tool registry
│   ├── commands/             # VS Code command implementations
│   ├── services/             # Shared services (audit, cache, etc.)
│   └── tools/                # MCP tool implementations
├── agents/
│   └── healthcare-compliance.md  # Agent definition
├── package.json              # Extension manifest
└── tsconfig.json            # TypeScript configuration
```

## Making Changes

### Branch Naming

Use descriptive branch names:
- `feature/add-calculator-xyz` - New features
- `fix/phi-detection-ssn` - Bug fixes
- `docs/update-readme` - Documentation updates
- `refactor/tool-registry` - Code refactoring

### Commit Messages

Follow conventional commit format:
```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Maintenance tasks

Examples:
```
feat(calculator): add MELD-Na score calculator
fix(phi): improve SSN detection accuracy
docs(readme): add installation instructions
```

## Pull Request Process

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** and commit them

3. **Ensure code compiles**
   ```bash
   npm run compile
   ```

4. **Run linting** (when available)
   ```bash
   npm run lint
   ```

5. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Open a Pull Request**
   - Provide a clear title and description
   - Reference any related issues
   - Include screenshots for UI changes

### PR Requirements

- [ ] Code compiles without errors
- [ ] All existing functionality still works
- [ ] New features include documentation
- [ ] Commit messages follow conventions
- [ ] Branch is up-to-date with main

## Coding Standards

### TypeScript

- Use strict TypeScript (`"strict": true`)
- Prefer `interface` over `type` for object shapes
- Use meaningful variable and function names
- Add JSDoc comments for public APIs

```typescript
/**
 * Detects PHI patterns in the provided text
 * @param content - The text content to scan
 * @param options - Detection options
 * @returns Array of PHI findings with confidence scores
 */
export async function detectPhi(
  content: string, 
  options: PhiDetectionOptions
): Promise<PhiFinding[]> {
  // Implementation
}
```

### Error Handling

- Always handle potential errors
- Provide meaningful error messages
- Use VS Code's logging infrastructure

```typescript
try {
  const result = await apiCall();
} catch (error) {
  logger.error('API call failed', { error, context: 'npi-lookup' });
  throw new Error(`NPI lookup failed: ${error.message}`);
}
```

### Security Considerations

- Never log PHI or sensitive data
- Use VS Code's SecretStorage for API keys
- Validate all external inputs
- Follow OWASP guidelines for any web requests

## Testing

### Manual Testing

1. Launch Extension Development Host (`F5`)
2. Open a test workspace with sample files
3. Test each MCP tool via Copilot Chat
4. Verify commands work correctly

### Test Scenarios

When adding new features, test:
- [ ] Happy path functionality
- [ ] Error handling and edge cases
- [ ] Graceful degradation (no API keys)
- [ ] Performance with large files

## Documentation

### Code Documentation

- Add JSDoc comments to exported functions
- Include `@param` and `@returns` annotations
- Document any side effects

### README Updates

When adding features:
- Update the features table
- Add usage examples
- Update configuration if needed

### Agent Definition

If modifying tool behavior:
- Update `agents/healthcare-compliance.md`
- Include example interactions

## Adding New Tools

### 1. Create Tool File

Create `src/tools/your-tool.ts`:

```typescript
import { TextContent } from '@modelcontextprotocol/sdk/types.js';
import { AuditService } from '../services/audit';

export async function yourTool(
  args: YourToolArgs,
  audit: AuditService
): Promise<TextContent> {
  // Implementation
  
  await audit.log({
    action: 'your_tool',
    details: { /* non-sensitive details */ }
  });
  
  return {
    type: 'text',
    text: formatOutput(result)
  };
}
```

### 2. Register in MCP Server

Add to `src/mcp-server.ts`:

```typescript
{
  name: 'your_tool',
  description: 'Description of what your tool does',
  inputSchema: {
    type: 'object',
    properties: {
      // Define input schema
    },
    required: ['requiredField']
  }
}
```

### 3. Add to handleToolCall

```typescript
case 'your_tool':
  return yourTool(args, audit);
```

### 4. Update Documentation

- Add to README tools table
- Update agent definition
- Add usage examples

## Adding Clinical Calculators

When adding new clinical calculators:

1. **Source Requirements**
   - Must be from peer-reviewed guidelines
   - Include citation and publication year
   - Document any limitations

2. **Implementation**
   - Add to `src/tools/clinical-calculator.ts`
   - Include all formula parameters
   - Add interpretation thresholds
   - Return guideline source

3. **Validation**
   - Test with known reference values
   - Validate edge cases
   - Document any differences from original

## Questions?

- Open a [GitHub Issue](https://github.com/gerinsights/healthcare-compliance-vscode/issues)
- Tag with `question` label

## License

By contributing, you agree that your contributions will be licensed under the Apache License 2.0.
