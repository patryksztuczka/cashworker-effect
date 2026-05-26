# Home Budget Application - High-Level Spec

## Purpose

Build a private, multi-user home budget web application where users can import bank statements, automatically create bank accounts from those statements when needed, import transactions, and apply simple categorization rules.

The first version is intentionally narrow: it supports one specific bank statement format provided as a PDF file from one bank.

## Product Shape

The application is a web application with multi-user data isolation from the beginning.

Each user has their own budget data. Bank accounts, statement imports, transactions, categorization rules, and import history are scoped to the authenticated user.

Households, shared accounts, collaboration, and team access are out of scope for the first version.

## Authentication

The application uses simple email and password authentication.

Signup requires email verification:

- A user signs up with email and password.
- The system creates an unverified user account.
- The system sends a verification email.
- The user must verify their email before accessing budget features.
- Unverified users may request a new verification email.
- Unverified users cannot import statements, view accounts, view transactions, or manage rules.

Password reset is not required for the first module unless explicitly prioritized later.

## Statement Import Flow

The first version supports importing a PDF bank statement from one specific bank.

The import flow is immediate and atomic:

1. The verified user uploads a supported PDF statement.
2. The system creates an import record.
3. The system parses the statement using the dedicated parser for the supported bank format.
4. The system validates that required data was extracted.
5. The system creates the bank account if it does not already exist for the user.
6. The system imports transactions and links them to the bank account.
7. The system applies simple categorization rules.
8. The user sees an import result summary.

If parsing or validation fails, no account or transactions are imported from that file.

There is no manual review step before saving transactions in v1.

## Duplicate Handling

Duplicate prevention is required in v1.

At the product level:

- Every uploaded statement creates an import record.
- Successful imports are retained in import history.
- Importing the same statement again must not create duplicate transactions.
- If the system detects that a statement was already imported, it should report that clearly.

The exact duplicate detection strategy is deferred to the Statement Import and Bank Statement Parser module planning.

## Statement Parsing

The first parser is deterministic.

The system should parse the PDF using deterministic PDF text/table extraction. OCR and AI-based extraction are out of scope for v1 unless the real sample statement proves deterministic parsing is not viable.

Parser implementation details are intentionally deferred to the Bank Statement Parser planning unit.

## Transaction Categorization

Transactions should be categorized after import using a simple rule set.

The first version should support basic deterministic rules. The exact rule model is deferred, but likely examples include:

- Match by transaction description text.
- Match by counterparty name.
- Match by amount range or exact amount if useful.
- Assign a category when a rule matches.

Machine-learning categorization, automatic suggestions, and complex rule prioritization are out of scope for v1 unless later selected explicitly.

## High-Level Modules

### 1. Authentication & Email Verification

Responsible for signup, login, session handling, email verification, resend verification, and access control for verified users.

### 2. User Boundary

Responsible for ensuring all budget data belongs to a user and cannot be accessed across users.

This is a cross-cutting module rather than a large standalone feature.

### 3. Bank Accounts

Responsible for storing user bank accounts created from imported statements.

The first version does not require manual account creation unless later prioritized.

### 4. Statement Import

Responsible for upload handling, import lifecycle, atomic import orchestration, duplicate prevention, and import result reporting.

This module coordinates parsing, account creation/reuse, transaction import, categorization, and failure handling.

### 5. Bank Statement Parser

Responsible for extracting normalized statement data from the supported bank PDF format.

This module is planned separately because the real PDF format will drive its design.

### 6. Transactions

Responsible for storing imported transactions, linking them to bank accounts, and exposing them for viewing and later budgeting workflows.

### 7. Categorization Rules

Responsible for defining and applying simple deterministic rules that assign categories to imported transactions.

### 8. Import History & Errors

Responsible for showing past imports, import statuses, success summaries, and clear failure messages.

### 9. Application Shell / Basic UI

Responsible for the authenticated application layout and basic screens:

- signup
- email verification state
- login
- statement upload
- import result
- accounts list
- transactions list
- categorization rules
- import history

## Suggested Implementation Order

1. Authentication & email verification
2. User data boundary
3. Bank account model
4. Transaction model
5. Import record model and import lifecycle
6. Bank statement parser for the first PDF format
7. Atomic statement import orchestration
8. Duplicate prevention
9. Basic categorization rules
10. Import history and result UI
11. Accounts and transactions UI

## Deferred Decisions

These should be decided during detailed planning for the relevant module, not in this high-level spec:

- Exact PDF parsing technique and library.
- Exact account identity extraction and matching strategy.
- Exact transaction duplicate detection algorithm.
- Exact categorization rule schema and priority behavior.
- Whether to store original uploaded PDF files permanently.
- Whether to support password reset in v1.
- Whether users can edit imported transactions in v1.
- Whether users can manually create or rename accounts in v1.
- Whether categories are fixed, user-defined, or both.
