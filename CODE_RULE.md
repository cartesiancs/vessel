# Coding Rules

This document establishes the official coding standards for all mission-critical software. Adherence to these rules is mandatory to ensure maximum safety, reliability, and security. The guiding principle is to produce code that is robust, predictable, and resilient under all operating conditions by managing the entire development lifecycle, not just the code itself.

## ## Core Principles

### 1. Fail-Safe Principle

All systems must be designed to default to a safe state in the event of any failure. The software must anticipate failures and handle them gracefully without compromising the integrity of the mission or system.

- **R1.1: No Silent Failures.** All fallible operations **must** return an explicit result type (e.g., `Result<T, E>` or a `Promise<T>`). The consuming code **must** exhaustively handle both success and failure states. Linter rules must be configured to fail the build on any unhandled error or result.
- **R1.2: Graceful Degradation.** In the event of a non-critical component failure, the system must continue to operate, albeit in a degraded mode. The software must be able to isolate faults and prevent them from cascading.
- **R1.3: Explicit Resource Management.** Leverage language features for automatic resource cleanup where available (e.g., RAII). For resources not managed automatically, cleanup **must** be guaranteed using deterministic patterns like `try...finally` blocks.

### 2. Deterministic Behavior

The software's output must depend solely on its inputs, and its execution time must be predictable and bounded. Non-deterministic behavior introduces unacceptable risk.

- **R2.1: Minimize and Isolate Dynamic Allocation.** After an initial setup phase, dynamic heap allocation should be avoided in performance-critical loops. Where unavoidable, use patterns like object pooling and pre-allocated buffers with fixed capacity to control memory usage.
- **R2.2: Forbid Recursion.** Recursive function calls are prohibited. All recursive algorithms **must** be implemented iteratively to prevent stack overflow errors.
- **R2.3: Avoid Floating-Point Ambiguity.** Never compare floating-point numbers for exact equality. Comparisons **must** be made within a defined tolerance (`epsilon`).
- **R2.4: Use Fixed-Size Data Structures.** All data structures, including arrays and buffers, **must** have a fixed, statically defined maximum size to prevent buffer overflows.
- **R2.5: Use Named Constants over Magic Numbers.** Do not use unexplained numeric literals. Use the language's constant features (`const`, `static`, `enum`) to define all such values.

### 3. Security by Design

Security is not an afterthought; it is an integral part of the design process. The system must be architected to be secure from the ground up.

- **R3.1: Default to Secure.** The default state of any system parameter **must** be the most secure state. Permissions should be denied by default and only explicitly granted.
- **R3.2: Validate All External Inputs.** All data originating from outside a trusted boundary is considered hostile. It **must** be validated at runtime before use, as compile-time type safety is insufficient for external data.
- **R3.3: Principle of Least Privilege.** Each software module **must** only be granted the permissions and access rights essential for its designated task.
- **R3.4: Keep it Simple.** Code complexity is the enemy of security. Avoid complex control flows and deep nesting. Prefer simple, linear logic that is easy to inspect and verify.
- **R3.5: Ensure Data Integrity.** Use mechanisms like CRCs or checksums to verify the integrity of critical data, especially during transmission or storage.

### 4. Concurrency and Real-Time Behavior

Systems with multiple threads or processes must behave predictably and meet their operational deadlines without fail.

- **R4.1: Avoid Shared Mutable State.** The modification of shared data by multiple threads should be forbidden or strictly controlled. Use language-enforced safety mechanisms where available, and prefer message-passing architectures over shared memory.
- **R4.2: Bounded Execution Time.** All tasks and functions **must** have a provable worst-case execution time (WCET) to ensure the system can meet its real-time deadlines.
- **R4.3: Handle Interrupts with Extreme Care.** Interrupt Service Routines (ISRs) **must** be as short and simple as possible. Forbid any non-deterministic operations within an ISR.

### 5. Verification and Validation (V&V)

It is not enough for code to be well-written; it must be proven to meet its requirements correctly.

- **R5.1: Traceability to Requirements.** Every line of code **must** trace back to a specific, documented requirement. No code should exist that does not fulfill a requirement.
- **R5.2: Mandatory Peer Reviews.** All code **must** be reviewed by at least one other qualified engineer before being integrated. This is a critical step for quality assurance.
- **R5.3: Strive for 100% Test Coverage.** All code **must** be unit-tested, with the goal of achieving 100% statement and branch coverage to ensure every execution path is verified.

### 6. Toolchain and Dependency Integrity

The reliability of the final product depends on the reliability of the tools and libraries used to create it.

- **R6.1: Vet All Third-Party Code.** Any external library or open-source component **must** undergo a rigorous vetting process for security and reliability before it can be used.
- **R6.2: Lock Compiler and Dependency Versions.** The exact versions of the compiler, libraries, and all other build tools **must** be specified and locked using the language's standard lock file mechanism (e.g., `Cargo.lock`, `package-lock.json`).

---

## Minor Rule

### m1. Everything is Strict

A strict development environment minimizes ambiguity and catches errors at the earliest possible stage.

- **R_m1.1: Zero Tolerance for Warnings.** All available compiler and linter checks **must** be enabled at their strictest levels. Any build that produces a warning is considered a failed build and **must** be corrected.
- **R_m1.2: Enforce a Single Coding Standard.** All code **must** be formatted using the standard automated tool for the language (e.g., `rustfmt`, `prettier`). The formatter **must** be run as a pre-commit hook.
- **R_m1.3: Use Comprehensive Static Analysis.** All code **must** pass a comprehensive suite of static analysis tools (e.g., `Clippy`, `ESLint`) without errors before being committed. The linter's ruleset **must** be configured for maximum strictness.
