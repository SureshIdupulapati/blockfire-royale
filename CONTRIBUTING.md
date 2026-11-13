# Contributing to BlockFire: Craft Royale

Thank you for your interest in contributing to **BlockFire: Craft Royale**!

## Development Guidelines

1. **Code Standards**:
   - Write clean, modular TypeScript with strict type annotations.
   - Avoid `any` types wherever possible.
   - Follow semantic commit messages (`feat:`, `fix:`, `test:`, `docs:`, `ci:`).

2. **Branching Strategy**:
   - `main`: Production-ready release branch.
   - Feature branches: `feat/<feature-name>`, `fix/<issue-name>`.

3. **Testing**:
   - Run the test suite before submitting pull requests:
     ```bash
     npm run test
     ```
   - Ensure all new modules have corresponding unit tests in `tests/`.

4. **Building**:
   - Verify the production bundle builds without errors:
     ```bash
     npm run build
     ```

